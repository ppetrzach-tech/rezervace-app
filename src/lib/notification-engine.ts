import { addMinutes } from "date-fns";
import { prisma } from "./db";
import { sendTemplatedEmail } from "./email";
import { generateIcs } from "./ics";
import { locationLabel } from "./branding";
import { czDate, czTime } from "./datetime";
import { vocativeFirstName, formalGreeting, firstName } from "./czech-name";
import { markdownishToHtml } from "./email-format";

type Vars = Record<string, string>;

function applyTemplate(text: string, vars: Vars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => vars[key] ?? "");
}

const plaintextToHtml = markdownishToHtml;


/**
 * Spuštění notifikačního engine — projde všechna pravidla,
 * najde rezervace, na které mají dopadnout, a odešle email/SMS.
 * Loguje do NotificationLog, takže neopakuje.
 */
export async function processNotifications(): Promise<{
  processed: number;
  emailSent: number;
  smsSent: number;
  errors: number;
}> {
  const now = new Date();
  // Toleranční okno — pravidlo se má aplikovat, pokud jsme do 60 minut po cílovém čase
  const TOLERANCE_MIN = 60;

  // Najdeme všechna aktivní pravidla
  const rules = await prisma.notificationRule.findMany({
    where: { enabled: true },
  });

  let emailSent = 0;
  let smsSent = 0;
  let errors = 0;
  let processed = 0;

  // Pro každé pravidlo najdeme rezervace, pro které je aktuálně čas notifikaci poslat.
  //
  // DŮLEŽITÉ — kotva (anchor) podle směru:
  //  • offset < 0  (PŘED schůzkou)  → počítá se od ZAČÁTKU (startsAt)
  //      např. -1440 = 24 h před začátkem prohlídky
  //  • offset >= 0 (PO schůzce)     → počítá se od KONCE (endsAt)
  //      např. +10 = 10 minut po skončení prohlídky
  //      (prohlídka 14:00–14:30 → +10 email vyjde ve 14:40, ne 14:10)
  //
  // Aktivační okno: target <= now <= target + TOLERANCE
  //   target = anchor + offset
  //   => anchor v rozsahu [now - offset - TOLERANCE, now - offset]
  for (const rule of rules) {
    const anchorField = rule.offsetMinutes < 0 ? "startsAt" : "endsAt";

    const windowEnd = addMinutes(now, -rule.offsetMinutes);
    const windowStart = addMinutes(windowEnd, -TOLERANCE_MIN);

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId: rule.tenantId,
        status: { not: "cancelled" },
        [anchorField]: { gte: windowStart, lte: windowEnd },
      },
      include: {
        client: true,
        service: true,
        provider: true,
        listing: true,
        tenant: true,
        notifications: { where: { ruleId: rule.id } },
      },
    });

    for (const booking of bookings) {
      if (booking.notifications.length > 0) continue; // už jsme posílali
      if (rule.onlyIfNotConfirmed && booking.confirmedByClientAt) continue;
      processed++;

      const dateFmt = czDate(booking.startsAt);
      const timeFmt = czTime(booking.startsAt);
      const businessName = booking.tenant.name;
      const location = booking.listing?.address || booking.service.locationDetail || locationLabel(booking.service.locationType);

      const confirmUrl = booking.confirmationToken
        ? `${process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app"}/booking/confirm/${booking.confirmationToken}`
        : "";

      const businessPhone = booking.tenant.ownerPhone ?? "";
      const vars: Vars = {
        client_name: booking.client.name,
        client_first_name: firstName(booking.client.name),
        client_vocative: vocativeFirstName(booking.client.name),
        client_greeting: formalGreeting(booking.client.name),
        client_email: booking.client.email,
        client_phone: booking.client.phone,
        service_name: booking.listing?.title || booking.service.name,
        provider_name: booking.provider.name,
        provider_phone: booking.provider.phone || businessPhone,
        provider_email: booking.provider.email ?? "",
        business_phone: businessPhone,
        date: dateFmt,
        time: timeFmt,
        location,
        confirm_url: confirmUrl,
        business_name: businessName,
        documents_url: booking.listing?.documentsUrl ?? "",
        virtual_tour_url: booking.listing?.virtualTourUrl ?? "",
        property_web_url: booking.listing?.propertyWebUrl ?? "",
        offer_form_url: booking.listing?.offerFormUrl ?? "",
      };

      try {
        if (rule.channel === "email") {
          const subject = applyTemplate(rule.subject ?? "", vars);
          let bodyHtml = plaintextToHtml(applyTemplate(rule.body, vars));
          if (rule.includeConfirmButton && confirmUrl) {
            bodyHtml += `
              <div style="margin: 24px 0;">
                <a href="${confirmUrl}"
                   style="display: inline-block; background: #2563eb; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  ✅ Potvrdit termín
                </a>
              </div>
            `;
          }
          let ics: string | undefined;
          if (rule.includeIcs) {
            ics = generateIcs({
              uid: `booking-${booking.id}@rezervace`,
              title: `${booking.listing?.title || booking.service.name} — ${businessName}`,
              description: booking.note ?? undefined,
              location: booking.listing?.address ?? booking.service.locationDetail ?? undefined,
              startsAt: booking.startsAt,
              endsAt: booking.endsAt,
              organizerName: businessName,
              organizerEmail: booking.provider.email ?? undefined,
            });
          }
          const res = await sendTemplatedEmail({
            to: booking.client.email,
            subject: subject || `Připomínka — ${vars.service_name}`,
            bodyHtml,
            ics,
            businessName,
            replyTo:
              booking.tenant.replyToEmail || booking.tenant.ownerEmail || undefined,
          });
          if (res.ok) emailSent++;
          else errors++;
          await prisma.notificationLog.create({
            data: {
              bookingId: booking.id,
              ruleId: rule.id,
              channel: "email",
              status: res.ok ? "sent" : "failed",
              error: res.error ?? null,
            },
          });
        } else if (rule.channel === "sms") {
          const message = applyTemplate(rule.body, vars);
          const { sendSmsRaw } = await import("./sms");
          const res = await sendSmsRaw(booking.client.phone, message);
          if (res.ok) smsSent++;
          else errors++;
          await prisma.notificationLog.create({
            data: {
              bookingId: booking.id,
              ruleId: rule.id,
              channel: "sms",
              status: res.ok ? "sent" : "failed",
              error: res.error ?? null,
            },
          });
        }
      } catch (err) {
        errors++;
        console.error("[notifications]", err);
        await prisma.notificationLog.create({
          data: {
            bookingId: booking.id,
            ruleId: rule.id,
            channel: rule.channel,
            status: "failed",
            error: String(err),
          },
        });
      }
    }
  }

  return { processed, emailSent, smsSent, errors };
}

import { addMinutes, format } from "date-fns";
import { cs } from "date-fns/locale";
import { prisma } from "./db";
import { escapeHtml, sendTemplatedEmail } from "./email";
import { generateIcs } from "./ics";
import { locationLabel } from "./branding";

type Vars = Record<string, string>;

function applyTemplate(text: string, vars: Vars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => vars[key] ?? "");
}

function plaintextToHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

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

  // Pro každé pravidlo najdeme rezervace, pro které je aktuálně čas notifikaci poslat
  for (const rule of rules) {
    // Cílový čas notifikace = booking.startsAt + offsetMinutes
    // Aktivační okno: targetTime <= now <= targetTime + TOLERANCE
    // Tedy: now - TOLERANCE <= booking.startsAt + offset <= now
    // => booking.startsAt rozsah:
    //    od (now - offset - TOLERANCE)
    //    do (now - offset)

    const windowEnd = addMinutes(now, -rule.offsetMinutes);
    const windowStart = addMinutes(windowEnd, -TOLERANCE_MIN);

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId: rule.tenantId,
        status: { not: "cancelled" },
        startsAt: { gte: windowStart, lte: windowEnd },
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

      const dateFmt = format(booking.startsAt, "d. M. yyyy", { locale: cs });
      const timeFmt = format(booking.startsAt, "HH:mm");
      const businessName = booking.tenant.name;
      const location = booking.listing?.address || booking.service.locationDetail || locationLabel(booking.service.locationType);

      const confirmUrl = booking.confirmationToken
        ? `${process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app"}/booking/confirm/${booking.confirmationToken}`
        : "";

      const vars: Vars = {
        client_name: booking.client.name,
        service_name: booking.listing?.title || booking.service.name,
        provider_name: booking.provider.name,
        date: dateFmt,
        time: timeFmt,
        location,
        confirm_url: confirmUrl,
        business_name: businessName,
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

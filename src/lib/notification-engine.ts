import { addMinutes } from "date-fns";
import { randomUUID } from "crypto";
import { prisma } from "./db";
import { sendTemplatedEmail } from "./email";
import { calendarButtonsHtml } from "./calendar-links";
import { PUBLIC_BASE_URL } from "./base-url";
import { locationLabel } from "./branding";
import { czDate, czTime } from "./datetime";
import {
  vocativeFirstName,
  formalGreeting,
  firstName,
  genderizeFormalText,
} from "./czech-name";
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
      if (booking.emailingStopped) continue; // klient/vlastník zastavil další emaily
      if (rule.onlyIfNotConfirmed && booking.confirmedByClientAt) continue;
      processed++;

      const dateFmt = czDate(booking.startsAt);
      const timeFmt = czTime(booking.startsAt);
      const businessName = booking.tenant.name;
      const location = booking.listing?.address || booking.service.locationDetail || locationLabel(booking.service.locationType);

      const baseUrl = PUBLIC_BASE_URL;
      const confirmUrl = booking.confirmationToken
        ? `${baseUrl}/booking/confirm/${booking.confirmationToken}`
        : "";
      const manageUrl = booking.confirmationToken
        ? `${baseUrl}/booking/manage/${booking.confirmationToken}`
        : "";
      const builtInOfferUrl = booking.listing
        ? `${baseUrl}/${booking.tenant.slug}/p/${booking.listing.slug}/nabidka`
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
        manage_url: manageUrl,
        business_name: businessName,
        documents_url: booking.listing?.documentsUrl ?? "",
        virtual_tour_url: booking.listing?.virtualTourUrl ?? "",
        property_web_url: booking.listing?.propertyWebUrl ?? "",
        // VŽDY vestavěný nabídkový formulář — aby nehrozil starý externí odkaz.
        offer_url: builtInOfferUrl,
        offer_form_url: builtInOfferUrl,
      };

      try {
        if (rule.channel === "email") {
          const clientName = booking.client.name;
          const subject = genderizeFormalText(
            applyTemplate(rule.subject ?? "", vars),
            clientName,
          );
          let bodyHtml = plaintextToHtml(
            genderizeFormalText(applyTemplate(rule.body, vars), clientName),
          );
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
          // Tlačítka "Přidat do kalendáře" (Google + .ics ke stažení)
          if (rule.includeIcs) {
            bodyHtml += calendarButtonsHtml({
              title: `${vars.service_name} — ${businessName}`,
              startsAt: booking.startsAt,
              endsAt: booking.endsAt,
              location:
                booking.listing?.address ??
                booking.service.locationDetail ??
                undefined,
              icsUrl: booking.confirmationToken
                ? `${baseUrl}/api/booking-ics/${booking.confirmationToken}`
                : undefined,
            });
          }
          // Nenápadný odkaz na správu rezervace — podle načasování pravidla:
          //  • offset < 0            → PŘED prohlídkou: přeplánovat / zrušit / odmítnout
          //  • 0 ≤ offset < 12 h     → děkovný email hned po prohlídce: BEZ patičky (jen poděkování)
          //  • offset ≥ 12 h         → pozdější follow-up (+24/48 h, řeší se nabídka): jen "nemám zájem"
          const POST_FOLLOWUP_MIN = 12 * 60; // 720 min
          if (manageUrl) {
            let footerInner: string | null = null;
            if (rule.offsetMinutes < 0) {
              footerInner = `Potřebujete <a href="${manageUrl}" style="color:#2563eb;">přeplánovat nebo zrušit termín</a>? Nebo už <a href="${manageUrl}" style="color:#2563eb;">nemáte zájem</a>?`;
            } else if (rule.offsetMinutes >= POST_FOLLOWUP_MIN) {
              footerInner = `Už <a href="${manageUrl}" style="color:#2563eb;">nemáte o nemovitost zájem</a>? Dejte mi prosím vědět.`;
            }
            // 0 ≤ offset < 12 h → děkovný email → žádná patička
            if (footerInner) {
              bodyHtml += `
                <div style="margin: 20px 0 0; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
                  ${footerInner}
                </div>
              `;
            }
          }
          // Předgenerované ID logu → tracking pixel pro zjištění otevření e-mailu
          const logId = randomUUID();
          bodyHtml += `<img src="${baseUrl}/api/track/${logId}" width="1" height="1" alt="" style="display:none" />`;
          const res = await sendTemplatedEmail({
            to: booking.client.email,
            subject: subject || `Připomínka — ${vars.service_name}`,
            bodyHtml,
            businessName,
            replyTo:
              booking.tenant.replyToEmail || booking.tenant.ownerEmail || undefined,
          });
          if (res.ok) emailSent++;
          else errors++;
          await prisma.notificationLog.create({
            data: {
              id: logId,
              bookingId: booking.id,
              ruleId: rule.id,
              channel: "email",
              label: rule.name,
              status: res.ok ? "sent" : "failed",
              error: res.error ?? null,
            },
          });
        } else if (rule.channel === "sms") {
          const message = genderizeFormalText(
            applyTemplate(rule.body, vars),
            booking.client.name,
          );
          const { sendSmsRaw } = await import("./sms");
          const res = await sendSmsRaw(booking.client.phone, message);
          if (res.ok) smsSent++;
          else errors++;
          await prisma.notificationLog.create({
            data: {
              bookingId: booking.id,
              ruleId: rule.id,
              channel: "sms",
              label: rule.name,
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

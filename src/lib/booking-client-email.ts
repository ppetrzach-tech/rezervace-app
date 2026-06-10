import { sendEmail, type SendEmailResult } from "./email-provider";
import { escapeHtml } from "./email";
import { markdownishToHtml } from "./email-format";
import { formalGreeting, gendered } from "./czech-name";
import { czDateTimeLong } from "./datetime";
import { PUBLIC_BASE_URL } from "./base-url";

type BookingForEmail = {
  client: { name: string; email: string };
  service: { name: string };
  provider: { name: string; phone: string | null };
  listing: { title: string; slug: string } | null;
  startsAt: Date;
  tenant: {
    name: string;
    slug: string;
    replyToEmail: string | null;
    ownerEmail: string | null;
    ownerPhone: string | null;
  };
};

/**
 * E-mail klientovi, když vlastník/asistent v dashboardu zruší nebo přeplánuje
 * jeho rezervaci. (Klientem iniciované změny řeší /api/booking-manage.)
 */
export async function sendBookingChangeEmailToClient(
  booking: BookingForEmail,
  action: "cancel" | "reschedule",
): Promise<SendEmailResult> {
  const serviceName = booking.listing?.title || booking.service.name;
  const dateStr = czDateTimeLong(booking.startsAt);
  const greeting = formalGreeting(booking.client.name);
  const chtel = gendered(booking.client.name, "chtěl", "chtěla");
  const phone = booking.provider.phone || booking.tenant.ownerPhone || "";
  const replyTo =
    booking.tenant.replyToEmail || booking.tenant.ownerEmail || undefined;
  const propertyUrl = booking.listing
    ? `${PUBLIC_BASE_URL}/${booking.tenant.slug}/p/${booking.listing.slug}`
    : `${PUBLIC_BASE_URL}/${booking.tenant.slug}`;

  let subject: string;
  let body: string;
  if (action === "reschedule") {
    subject = `Přeplánování termínu — ${serviceName}`;
    body = `${greeting},

potřebuji s Vámi přeplánovat termín **${serviceName}** (${dateStr}). Omlouvám se za případnou komplikaci.

Vyberte si prosím nový termín, který Vám vyhovuje:
[📅 Vybrat nový termín](${propertyUrl})

Kdyby cokoliv, ozvěte se mi.

Přeji hezký den,
${booking.provider.name}${phone ? `\nTel.: ${phone}` : ""}`;
  } else {
    subject = `Zrušení termínu — ${serviceName}`;
    body = `${greeting},

Váš termín **${serviceName}** (${dateStr}) byl zrušen.

Pokud byste si ${chtel} vybrat nový termín, budu rád:
[📅 Vybrat termín](${propertyUrl})

V případě dotazů mi prosím napište nebo zavolejte.

Přeji hezký den,
${booking.provider.name}${phone ? `\nTel.: ${phone}` : ""}`;
  }

  return sendEmail({
    to: booking.client.email,
    subject,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="color:#6b7280;font-size:13px;">${escapeHtml(booking.tenant.name)}</div>
      <div style="margin-top:8px;">${markdownishToHtml(body)}</div>
    </div>`,
    replyTo,
  });
}

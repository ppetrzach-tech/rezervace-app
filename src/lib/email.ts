import { Resend } from "resend";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { branding, locationEmoji, locationLabel } from "./branding";

const resendKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || "Rezervace <noreply@example.com>";

const resend = resendKey ? new Resend(resendKey) : null;

type BookingEmailData = {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  providerName: string;
  startsAt: Date;
  durationMinutes: number;
  priceCzk: number;
  showPrice?: boolean;
  locationType?: string;
  locationDetail?: string | null;
  note?: string | null;
  bookingId: string;
  businessName?: string;
  ics?: string;
};

function formatDateCs(date: Date): string {
  return format(date, "EEEE d. MMMM yyyy 'v' HH:mm", { locale: cs });
}

export async function sendBookingConfirmationEmail(
  data: BookingEmailData,
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY není nastaven — email se neodeslal:",
      data.clientEmail,
    );
    return { ok: false, error: "RESEND_API_KEY chybí" };
  }

  const dateStr = formatDateCs(data.startsAt);

  try {
    await resend.emails.send({
      from: fromAddress,
      to: data.clientEmail,
      subject: `Potvrzení rezervace — ${data.serviceName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <div style="color: #6b7280; font-size: 13px;">${escapeHtml(data.businessName || branding.businessName)}</div>
          <h2 style="color: #1d4ed8; margin-top: 4px;">Vaše rezervace je potvrzena</h2>
          <p>Dobrý den ${escapeHtml(data.clientName)},</p>
          <p>děkujeme za rezervaci. Tady jsou detaily:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px 0; color: #6b7280;">Schůzka:</td><td><strong>${escapeHtml(data.serviceName)}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Osoba:</td><td>${escapeHtml(data.providerName)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Termín:</td><td><strong>${dateStr}</strong></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Trvání:</td><td>${data.durationMinutes} min</td></tr>
            ${data.locationType ? `<tr><td style="padding: 8px 0; color: #6b7280;">Místo:</td><td>${locationEmoji(data.locationType)} ${locationLabel(data.locationType)}${data.locationDetail ? `<br/><span style="color: #6b7280;">${escapeHtml(data.locationDetail)}</span>` : ""}</td></tr>` : ""}
            ${data.showPrice !== false && data.priceCzk > 0 ? `<tr><td style="padding: 8px 0; color: #6b7280;">Cena:</td><td>${data.priceCzk} Kč</td></tr>` : ""}
            ${data.note ? `<tr><td style="padding: 8px 0; color: #6b7280;">Poznámka:</td><td>${escapeHtml(data.note)}</td></tr>` : ""}
          </table>
          ${data.ics ? `<p style="color: #6b7280; font-size: 13px;">📅 V příloze najdete kalendářovou událost (.ics) — můžete si ji přidat do svého kalendáře.</p>` : ""}
          <p style="color: #6b7280; font-size: 13px;">Rezervační číslo: ${data.bookingId}</p>
          <p>Potřebujete změnu? Odpovězte na tento email.</p>
        </div>
      `,
      attachments: data.ics
        ? [
            {
              filename: "schuzka.ics",
              content: Buffer.from(data.ics, "utf8").toString("base64"),
            },
          ]
        : undefined,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Chyba odeslání:", err);
    return { ok: false, error: String(err) };
  }
}

export async function sendReminderEmail(
  data: BookingEmailData,
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY chybí — připomínka neodeslána.");
    return { ok: false, error: "RESEND_API_KEY chybí" };
  }
  const dateStr = formatDateCs(data.startsAt);
  try {
    await resend.emails.send({
      from: fromAddress,
      to: data.clientEmail,
      subject: `Připomínka: ${data.serviceName} zítra`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <div style="color: #6b7280; font-size: 13px;">${escapeHtml(data.businessName || branding.businessName)}</div>
          <h2 style="color: #1d4ed8;">Připomínáme vaši rezervaci</h2>
          <p>Dobrý den ${escapeHtml(data.clientName)},</p>
          <p>jen krátká připomínka, že zítra máte rezervovaný termín:</p>
          <p><strong>${escapeHtml(data.serviceName)}</strong> u ${escapeHtml(data.providerName)}<br/>
          <strong>${dateStr}</strong></p>
          <p>Těšíme se na vás!</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Chyba odeslání připomínky:", err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Obecné odeslání emailu na základě šablony — používá notifikační engine.
 * Podporuje proměnné v subject i body: {{client_name}}, {{service_name}}, {{date}}, {{time}}, {{location}}, {{confirm_url}}, {{business_name}}
 */
export type TemplatedEmailParams = {
  to: string;
  subject: string;
  bodyHtml: string;
  ics?: string;
  businessName?: string;
};

export async function sendTemplatedEmail(
  p: TemplatedEmailParams,
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY chybí — email se neodeslal:", p.to);
    return { ok: false, error: "RESEND_API_KEY chybí" };
  }
  try {
    await resend.emails.send({
      from: fromAddress,
      to: p.to,
      subject: p.subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          ${p.businessName ? `<div style="color: #6b7280; font-size: 13px;">${escapeHtml(p.businessName)}</div>` : ""}
          <div style="margin-top: 8px;">${p.bodyHtml}</div>
        </div>
      `,
      attachments: p.ics
        ? [
            {
              filename: "schuzka.ics",
              content: Buffer.from(p.ics, "utf8").toString("base64"),
            },
          ]
        : undefined,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] Chyba odeslání:", err);
    return { ok: false, error: String(err) };
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

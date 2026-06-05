import { branding, locationEmoji, locationLabel } from "./branding";
import { sendEmail, type SendEmailResult } from "./email-provider";
import { czDateTimeLong } from "./datetime";

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
  replyTo?: string;
};

function formatDateCs(date: Date): string {
  return czDateTimeLong(date);
}

function icsAttachment(ics?: string) {
  if (!ics) return undefined;
  return [
    {
      filename: "schuzka.ics",
      content: Buffer.from(ics, "utf8").toString("base64"),
    },
  ];
}

export async function sendBookingConfirmationEmail(
  data: BookingEmailData,
): Promise<SendEmailResult> {
  const dateStr = formatDateCs(data.startsAt);
  const html = `
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
  `;

  return sendEmail({
    to: data.clientEmail,
    subject: `Potvrzení rezervace — ${data.serviceName}`,
    html,
    attachments: icsAttachment(data.ics),
    replyTo: data.replyTo,
  });
}

export async function sendReminderEmail(
  data: BookingEmailData,
): Promise<SendEmailResult> {
  const dateStr = formatDateCs(data.startsAt);
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="color: #6b7280; font-size: 13px;">${escapeHtml(data.businessName || branding.businessName)}</div>
      <h2 style="color: #1d4ed8;">Připomínáme vaši rezervaci</h2>
      <p>Dobrý den ${escapeHtml(data.clientName)},</p>
      <p>jen krátká připomínka, že zítra máte rezervovaný termín:</p>
      <p><strong>${escapeHtml(data.serviceName)}</strong> u ${escapeHtml(data.providerName)}<br/>
      <strong>${dateStr}</strong></p>
      <p>Těšíme se na vás!</p>
    </div>
  `;
  return sendEmail({
    to: data.clientEmail,
    subject: `Připomínka: ${data.serviceName} zítra`,
    html,
  });
}

/**
 * Obecné odeslání emailu na základě šablony — používá notifikační engine.
 */
export type TemplatedEmailParams = {
  to: string;
  subject: string;
  bodyHtml: string;
  ics?: string;
  businessName?: string;
  replyTo?: string;
};

export async function sendTemplatedEmail(
  p: TemplatedEmailParams,
): Promise<SendEmailResult> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      ${p.businessName ? `<div style="color: #6b7280; font-size: 13px;">${escapeHtml(p.businessName)}</div>` : ""}
      <div style="margin-top: 8px;">${p.bodyHtml}</div>
    </div>
  `;
  return sendEmail({
    to: p.to,
    subject: p.subject,
    html,
    attachments: icsAttachment(p.ics),
    replyTo: p.replyTo,
  });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

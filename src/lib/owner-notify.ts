import { escapeHtml } from "./email";
import { sendEmail, type SendEmailResult } from "./email-provider";
import { czDateTimeLong } from "./datetime";

type OwnerBookingData = {
  ownerEmail: string;
  businessName: string;
  serviceName: string;
  providerName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientNote?: string | null;
  startsAt: Date;
  durationMinutes: number;
  location?: string | null;
  bookingId: string;
  publicBookingsUrl?: string;
  customAnswers?: Array<{ label: string; value: string }>;
  googleEventLink?: string | null;
  ics?: string;
};

/**
 * Email vlastníkovi (makléři) o nové rezervaci.
 */
export async function sendOwnerNewBookingEmail(
  data: OwnerBookingData,
): Promise<SendEmailResult> {
  if (!data.ownerEmail) {
    console.warn("[owner-notify] ownerEmail chybí.");
    return { ok: false, error: "ownerEmail chybí" };
  }

  const dateStr = czDateTimeLong(data.startsAt);

  const answersRows = (data.customAnswers ?? [])
    .filter((a) => a.value)
    .map(
      (a) =>
        `<tr><td style="padding:6px 0;color:#6b7280;">${escapeHtml(a.label)}:</td><td><strong>${escapeHtml(a.value)}</strong></td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background:#dbeafe; color:#1e3a8a; padding:12px 16px; border-radius:8px; font-weight:600;">
        🆕 Nová rezervace
      </div>
      <h2 style="margin-top:16px;">${escapeHtml(data.serviceName)}</h2>
      <p style="color:#6b7280;">${dateStr} · ${data.durationMinutes} min</p>

      <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#6b7280; width:140px;">Klient:</td><td><strong>${escapeHtml(data.clientName)}</strong></td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Email:</td><td><a href="mailto:${data.clientEmail}">${escapeHtml(data.clientEmail)}</a></td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Telefon:</td><td><a href="tel:${data.clientPhone}">${escapeHtml(data.clientPhone)}</a></td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Osoba (vy):</td><td>${escapeHtml(data.providerName)}</td></tr>
        ${data.location ? `<tr><td style="padding:6px 0; color:#6b7280;">Místo:</td><td>${escapeHtml(data.location)}</td></tr>` : ""}
        ${data.clientNote ? `<tr><td style="padding:6px 0; color:#6b7280; vertical-align:top;">Poznámka klienta:</td><td>${escapeHtml(data.clientNote)}</td></tr>` : ""}
      </table>

      ${
        answersRows
          ? `
        <h3 style="font-size:14px; color:#1e3a8a; margin: 24px 0 8px;">Odpovědi z formuláře</h3>
        <table style="width:100%; border-collapse:collapse;">
          ${answersRows}
        </table>
      `
          : ""
      }

      <div style="display:flex; gap:8px; margin-top:24px;">
        ${
          data.googleEventLink
            ? `<a href="${data.googleEventLink}" style="display:inline-block; background:#2563eb; color:white; padding:10px 16px; border-radius:8px; text-decoration:none; font-weight:600;">📅 Otevřít v Google Calendar</a>`
            : ""
        }
        ${
          data.publicBookingsUrl
            ? `<a href="${data.publicBookingsUrl}" style="display:inline-block; background:#e2e8f0; color:#1e3a8a; padding:10px 16px; border-radius:8px; text-decoration:none; font-weight:600;">Otevřít v dashboardu</a>`
            : ""
        }
      </div>

      <p style="color:#6b7280; font-size:12px; margin-top:24px;">
        Rezervace č. ${data.bookingId} · ${escapeHtml(data.businessName)}
      </p>
    </div>
  `;

  return sendEmail({
    to: data.ownerEmail,
    subject: `🆕 Nová rezervace: ${data.clientName} — ${dateStr}`,
    html,
    attachments: data.ics
      ? [
          {
            filename: "schuzka.ics",
            content: Buffer.from(data.ics, "utf8").toString("base64"),
          },
        ]
      : undefined,
  });
}

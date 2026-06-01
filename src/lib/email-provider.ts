/**
 * Email provider abstrakce — podporuje Resend i Ecomail.
 *
 * Detekce:
 *  1. Pokud je ECOMAIL_API_KEY nastaven → použije se Ecomail
 *  2. Jinak pokud je RESEND_API_KEY → použije se Resend
 *  3. Jinak → emaily se neodesílají (jen warn v konzoli)
 *
 * Společné API:
 *  - sendEmail({ to, subject, html, attachments }) → { ok, error? }
 *  - getProviderName() → "ecomail" | "resend" | null
 */

import { Resend } from "resend";

export type EmailAttachment = {
  filename: string;
  content: string; // base64
};

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
};

export type SendEmailResult = { ok: boolean; error?: string };

const fromEmail =
  process.env.EMAIL_FROM_ADDRESS ||
  parseFromAddress(process.env.EMAIL_FROM || "").email ||
  "noreply@example.com";
const fromName =
  process.env.EMAIL_FROM_NAME ||
  parseFromAddress(process.env.EMAIL_FROM || "").name ||
  "Rezervace";

const resendKey = process.env.RESEND_API_KEY;
const ecomailKey = process.env.ECOMAIL_API_KEY;

const resend = resendKey ? new Resend(resendKey) : null;

function parseFromAddress(s: string): { name: string; email: string } {
  // "Salon Krásy <noreply@example.cz>" → { name: "Salon Krásy", email: "noreply@example.cz" }
  const m = s.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: "", email: s.trim() };
}

export function getProviderName(): "ecomail" | "resend" | null {
  if (ecomailKey) return "ecomail";
  if (resendKey) return "resend";
  return null;
}

export function isEmailConfigured(): boolean {
  return getProviderName() !== null;
}

export async function sendEmail(p: SendEmailParams): Promise<SendEmailResult> {
  const provider = getProviderName();
  if (!provider) {
    console.warn("[email] Žádný email provider nenakonfigurován — email se neodeslal:", p.to);
    return { ok: false, error: "Žádný email provider (RESEND_API_KEY nebo ECOMAIL_API_KEY)" };
  }

  if (provider === "ecomail") return sendViaEcomail(p);
  return sendViaResend(p);
}

async function sendViaResend(p: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) return { ok: false, error: "Resend nenakonfigurován" };
  try {
    await resend.emails.send({
      from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
      to: p.to,
      subject: p.subject,
      html: p.html,
      replyTo: p.replyTo || undefined,
      attachments: p.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    return { ok: true };
  } catch (err) {
    console.error("[email/resend] Chyba odeslání:", err);
    return { ok: false, error: String(err) };
  }
}

async function sendViaEcomail(p: SendEmailParams): Promise<SendEmailResult> {
  if (!ecomailKey) return { ok: false, error: "Ecomail nenakonfigurován" };

  const body = {
    message: {
      subject: p.subject,
      from_name: fromName || "Rezervace",
      from_email: fromEmail,
      reply_to: p.replyTo || undefined,
      to: [{ email: p.to }],
      html: p.html,
      attachments:
        p.attachments && p.attachments.length > 0
          ? p.attachments.map((a) => ({
              file_name: a.filename,
              file_mime: a.filename.endsWith(".ics")
                ? "text/calendar"
                : "application/octet-stream",
              file_content: a.content, // base64
            }))
          : undefined,
    },
  };

  try {
    const res = await fetch("https://api2.ecomailapp.cz/transactional/send-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        key: ecomailKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[email/ecomail] Chyba odeslání:", res.status, text);
      return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email/ecomail] Chyba odeslání:", err);
    return { ok: false, error: String(err) };
  }
}

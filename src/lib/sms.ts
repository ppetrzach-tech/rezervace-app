import { czDayMonthTime } from "./datetime";

// GoSMS REST API: https://doc.gosms.cz
// Tok: 1) POST /oauth/v2/token (client_credentials) → access_token
//      2) POST /api/v1/messages s tokenem → odešle zprávu.

const TOKEN_URL = "https://app.gosms.cz/oauth/v2/token";
const MESSAGES_URL = "https://app.gosms.cz/api/v1/messages";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOSMS_CLIENT_ID;
  const clientSecret = process.env.GOSMS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "messages",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    console.error("[sms] Nepodařilo se získat token:", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

export type SmsResult = { ok: boolean; error?: string };

/**
 * Veřejný helper pro odeslání obecné SMS (používá notifikační engine).
 */
export async function sendSmsRaw(phone: string, message: string): Promise<SmsResult> {
  return sendSms(phone, message);
}

async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const channelId = process.env.GOSMS_CHANNEL_ID;
  if (!channelId) {
    console.warn("[sms] GOSMS_CHANNEL_ID není nastaven — SMS se neodeslala:", phone);
    return { ok: false, error: "GOSMS_CHANNEL_ID chybí" };
  }
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Nepodařilo se získat token GoSMS" };

  const payload: Record<string, unknown> = {
    message,
    recipients: [phone],
    channel: channelId,
  };
  const sender = process.env.GOSMS_SENDER;
  if (sender) payload.sender = sender;

  const res = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[sms] Chyba odeslání:", res.status, text);
    return { ok: false, error: `${res.status}: ${text}` };
  }
  return { ok: true };
}

type BookingSmsData = {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  providerName: string;
  startsAt: Date;
};

export async function sendBookingConfirmationSms(
  data: BookingSmsData,
): Promise<SmsResult> {
  const when = czDayMonthTime(data.startsAt);
  const message = `Potvrzeni rezervace: ${data.serviceName} u ${data.providerName} dne ${when}. Diky!`;
  return sendSms(data.clientPhone, message);
}

export async function sendReminderSms(data: BookingSmsData): Promise<SmsResult> {
  const when = czDayMonthTime(data.startsAt);
  const message = `Pripominka: zitra ${when} mate rezervaci ${data.serviceName} u ${data.providerName}. Tesime se!`;
  return sendSms(data.clientPhone, message);
}

/**
 * Google Calendar integrace přes Service Account.
 *
 * Setup (jednorázový):
 *  1. console.cloud.google.com → New Project
 *  2. APIs & Services → Library → "Google Calendar API" → Enable
 *  3. APIs & Services → Credentials → Create → Service Account
 *  4. Service Account → Keys tab → Add Key → JSON → Download
 *  5. V Vercel env nastavte:
 *      GOOGLE_SERVICE_ACCOUNT_EMAIL = obsah `client_email` z JSON
 *      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = obsah `private_key` z JSON (i s "BEGIN PRIVATE KEY" hlavičkou)
 *
 * Per-tenant setup:
 *  1. V Google Calendar nasdílejte kalendář na ten email (Make changes to events)
 *  2. V naší aplikaci uložte Calendar ID (typicky email tenanta nebo "...@group.calendar.google.com")
 */

import crypto from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API_BASE = "https://www.googleapis.com/calendar/v3";

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Vytvoří JWT podepsaný service-account klíčem (RS256) a vymění za OAuth access token.
 */
async function getAccessToken(): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) return null;

  // Pokud jsou \n escapované jako "\\n" (běžné když lepíme do Vercel env), opravíme:
  privateKey = privateKey.replace(/\\n/g, "\n");

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  let signed: string;
  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    signed = base64url(signer.sign(privateKey));
  } catch (err) {
    console.error("[gcal] JWT signing failed:", err);
    return null;
  }

  const jwt = `${unsigned}.${signed}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[gcal] Token exchange failed:", res.status, text);
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

/**
 * Vrátí email service-accountu (k zobrazení v UI, aby ho user nasdílel v Google Calendar).
 */
export function getServiceAccountEmail(): string | null {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;
}

export function isCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

export type CreateEventInput = {
  calendarId: string;
  timezone?: string;
  summary: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  attendees?: { email: string; displayName?: string }[];
};

export type CreateEventResult =
  | { ok: true; eventId: string; htmlLink?: string }
  | { ok: false; error: string };

/**
 * Vytvoří událost v Google Calendar.
 */
export async function createCalendarEvent(
  input: CreateEventInput,
): Promise<CreateEventResult> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Service Account není nakonfigurován" };

  const calendarId = encodeURIComponent(input.calendarId);
  const tz = input.timezone ?? "Europe/Prague";

  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startsAt.toISOString(), timeZone: tz },
    end: { dateTime: input.endsAt.toISOString(), timeZone: tz },
    // POZOR: účastníky (attendees) ZÁMĚRNĚ neposíláme.
    // Service Account bez domain-wide delegation nesmí přidávat účastníky —
    // Google by jinak CELÉ vytvoření události odmítl chybou
    // "Service accounts cannot invite attendees...". Údaje o klientovi
    // (jméno, e-mail, telefon) jsou součástí `description`, a potvrzení
    // klientovi posílá aplikace e-mailem (Ecomail), takže nic nechybí.
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: false,
  };

  const res = await fetch(
    `${API_BASE}/calendars/${calendarId}/events?sendUpdates=none`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.error("[gcal] Create event failed:", res.status, text);
    return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
  }
  const json = (await res.json()) as { id: string; htmlLink?: string };
  return { ok: true, eventId: json.id, htmlLink: json.htmlLink };
}

/**
 * Vrátí obsazené (busy) intervaly z kalendáře v daném okně.
 * Používá events.list (funguje s oprávněním calendar.events).
 * Slouží k blokaci slotů, které se kryjí s událostí ve vlastníkově kalendáři.
 */
export async function getBusyIntervals(
  calendarId: string,
  from: Date,
  to: Date,
): Promise<{ start: Date; end: Date }[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: {
      status?: string;
      transparency?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];
  };
  const out: { start: Date; end: Date }[] = [];
  for (const ev of json.items ?? []) {
    if (ev.status === "cancelled") continue;
    if (ev.transparency === "transparent") continue; // "volno" / nezabírá čas
    const s = ev.start?.dateTime ?? ev.start?.date;
    const e = ev.end?.dateTime ?? ev.end?.date;
    if (!s || !e) continue;
    out.push({ start: new Date(s), end: new Date(e) });
  }
  return out;
}

/**
 * Smaže událost (např. při zrušení rezervace).
 */
export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Service Account není nakonfigurován" };

  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
  }
  return { ok: true };
}

/**
 * Testovací volání — vrací stav přístupu ke kalendáři.
 * Užitečné v Settings → Integrace pro ověření, že je sdílení nastaveno.
 */
export async function testCalendarAccess(
  calendarId: string,
): Promise<{ ok: boolean; error?: string; calendarSummary?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Service Account není nakonfigurován" };

  // Testujeme přes endpoint UDÁLOSTÍ (ne metadata kalendáře) — oprávnění
  // service accountu je `calendar.events`, takže Calendars.get vrací 403 i u
  // správně nasdíleného kalendáře. Events.list odpovídá tomu, co appka reálně
  // dělá (zápis/čtení událostí), takže test je přesný.
  const res = await fetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?maxResults=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error:
        res.status === 404
          ? "Kalendář nenalezen — zkontrolujte Calendar ID."
          : res.status === 403
            ? "Kalendář není nasdílen na service account. Sdílejte ho přes Google Calendar → Nastavení a sdílení → s právem „Provádět změny v událostech“."
            : `${res.status}: ${text.slice(0, 300)}`,
    };
  }
  const json = (await res.json()) as { summary?: string };
  return { ok: true, calendarSummary: json.summary };
}

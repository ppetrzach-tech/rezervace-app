/**
 * Odkazy "Přidat do kalendáře" do těla emailu.
 *
 * Záměrně NEpřikládáme .ics jako přílohu — emailové aplikace (Seznam, Gmail)
 * by si u přílohy vykreslily vlastní tlačítka Přijmout/Odmítnout, která se ale
 * do našeho systému nepropíšou a klienty matou. Místo toho dáme do těla:
 *   • odkaz na Google kalendář (render?action=TEMPLATE…)
 *   • odkaz ke stažení .ics (přes /api/booking-ics/[token]) pro Apple/Outlook
 * Stažení .ics se spustí až po kliknutí, takže žádná matoucí RSVP tlačítka.
 */

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function fmtUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

export function googleCalendarUrl(p: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  details?: string;
  location?: string;
}): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", p.title);
  params.set("dates", `${fmtUtc(p.startsAt)}/${fmtUtc(p.endsAt)}`);
  if (p.details) params.set("details", p.details);
  if (p.location) params.set("location", p.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * HTML s tlačítky "Přidat do kalendáře" do těla emailu.
 */
export function calendarButtonsHtml(p: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  details?: string;
  location?: string;
  icsUrl?: string;
}): string {
  const gcal = googleCalendarUrl(p);
  const btn =
    "display:inline-block; margin:0 8px 8px 0; background:#ffffff; border:1px solid #cbd5e1; color:#334155; padding:9px 14px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:500;";
  return `
    <div style="margin: 20px 0;">
      <div style="font-size:13px; color:#64748b; margin-bottom:8px;">📅 Přidat do kalendáře:</div>
      <a href="${gcal}" style="${btn}">Google kalendář</a>${
        p.icsUrl
          ? `\n      <a href="${p.icsUrl}" style="${btn}">Apple / Outlook (.ics)</a>`
          : ""
      }
    </div>`;
}

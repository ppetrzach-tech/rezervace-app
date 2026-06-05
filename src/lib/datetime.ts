/**
 * Formátování času VŽDY v českém časovém pásmu (Europe/Prague),
 * nezávisle na tom, kde běží server (Vercel = UTC) nebo prohlížeč.
 *
 * Používá Intl/toLocaleString s timeZone, takže funguje stejně
 * na serveru i v prohlížeči.
 */

const TZ = "Europe/Prague";
const LOCALE = "cs-CZ";

/** "pondělí 15. června 2026 v 14:30" */
export function czDateTimeLong(date: Date): string {
  const d = date.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const t = date.toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${d} v ${t}`;
}

/** "15. 6. 2026" */
export function czDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/** "14:30" */
export function czTime(date: Date): string {
  return date.toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "15. 6. 14:30" */
export function czDayMonthTime(date: Date): string {
  const d = date.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
  });
  const t = czTime(date);
  return `${d} ${t}`;
}

/** "po 15. 6." — krátký den + datum (pro přehledové tabulky) */
export function czWeekdayDayMonth(date: Date): string {
  return date.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

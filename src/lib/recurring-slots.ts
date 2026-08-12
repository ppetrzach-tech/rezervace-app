import { prisma } from "./db";

/**
 * Opakující se termíny konzultací.
 *
 * Uživatel nastaví pravidla { weekday (0=Ne … 6=So), time "HH:MM" }. Z nich se
 * do budoucna generují REÁLNÉ EventSloty (na daný počet týdnů dopředu). Díky
 * tomu funguje rezervace i filtr Google kalendáře úplně stejně jako u ručních
 * termínů — jen je nemusí nikdo přidávat ručně.
 *
 * Časy jsou v „nástěnném" čase zóny tenanta (default Europe/Prague), správně
 * i přes letní/zimní čas (řešeno přes Intl).
 */

export type RecurringRule = { weekday: number; time: string };

// Kolik týdnů dopředu držet vygenerované. Cron to průběžně posouvá dál.
export const RECURRING_WEEKS_AHEAD = 10;

/** Bezpečně načte pravidla z JSON pole (ignoruje nevalidní záznamy). */
export function parseRecurringRules(value: unknown): RecurringRule[] {
  if (!Array.isArray(value)) return [];
  const out: RecurringRule[] = [];
  for (const r of value) {
    if (
      r &&
      typeof r === "object" &&
      typeof (r as { weekday?: unknown }).weekday === "number" &&
      typeof (r as { time?: unknown }).time === "string" &&
      /^\d{1,2}:\d{2}$/.test((r as { time: string }).time)
    ) {
      const weekday = (r as { weekday: number }).weekday;
      if (weekday >= 0 && weekday <= 6) {
        out.push({ weekday, time: (r as { time: string }).time });
      }
    }
  }
  return out;
}

/** Části data (rok/měsíc/den/den v týdnu) tak, jak je vidí daná časová zóna. */
function tzDateParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  const wd: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: parseInt(m.year, 10),
    month: parseInt(m.month, 10),
    day: parseInt(m.day, 10),
    weekday: wd[m.weekday] ?? 0,
  };
}

/**
 * Převede „nástěnný" čas (y/mo/d h:mi) v dané zóně na správný UTC Date.
 * Řeší letní čas tím, že spočítá offset zóny v daném okamžiku.
 */
function zonedWallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(guess));
  const m: Record<string, number> = {};
  for (const part of p) if (part.type !== "literal") m[part.type] = parseInt(part.value, 10);
  const h = m.hour === 24 ? 0 : m.hour;
  const asIfUtc = Date.UTC(m.year, m.month - 1, m.day, h, m.minute, m.second);
  const offset = asIfUtc - guess;
  return new Date(guess - offset);
}

/** Vygeneruje výskyty pravidel od `from` na `weeksAhead` týdnů dopředu. */
export function generateOccurrences(
  rules: RecurringRule[],
  durationMinutes: number,
  timeZone: string,
  from: Date,
  weeksAhead: number,
): { startsAt: Date; endsAt: Date }[] {
  const out: { startsAt: Date; endsAt: Date }[] = [];
  if (!rules.length) return out;
  const totalDays = weeksAhead * 7;
  for (let i = 0; i <= totalDays; i++) {
    // Poledne daného dne (vyhne se hraně půlnoci při přechodu letního času).
    const instant = new Date(from.getTime() + i * 86400000 + 12 * 3600000);
    const { year, month, day, weekday } = tzDateParts(instant, timeZone);
    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;
      const [hh, mm] = rule.time.split(":").map((x) => parseInt(x, 10));
      const startsAt = zonedWallTimeToUtc(year, month, day, hh, mm, timeZone);
      if (startsAt.getTime() <= from.getTime()) continue;
      out.push({
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationMinutes * 60000),
      });
    }
  }
  return out;
}

/**
 * Zajistí, že pro konzultaci existují reálné EventSloty odpovídající jejím
 * opakujícím se pravidlům (na RECURRING_WEEKS_AHEAD týdnů dopředu).
 * Vytvoří jen chybějící — existující (i rezervované) nechá být. Idempotentní.
 */
export async function ensureRecurringSlots(listing: {
  id: string;
  durationMinutes: number;
  recurringSlots: unknown;
  timeZone: string;
}): Promise<number> {
  const rules = parseRecurringRules(listing.recurringSlots);
  if (!rules.length) return 0;

  const from = new Date();
  const occ = generateOccurrences(
    rules,
    listing.durationMinutes,
    listing.timeZone || "Europe/Prague",
    from,
    RECURRING_WEEKS_AHEAD,
  );
  if (!occ.length) return 0;

  const windowEnd = new Date(
    from.getTime() + (RECURRING_WEEKS_AHEAD * 7 + 1) * 86400000,
  );
  const existing = await prisma.eventSlot.findMany({
    where: {
      listingId: listing.id,
      startsAt: { gte: from, lte: windowEnd },
    },
    select: { startsAt: true },
  });
  const existingSet = new Set(existing.map((s) => s.startsAt.getTime()));

  const toCreate = occ.filter((o) => !existingSet.has(o.startsAt.getTime()));
  if (!toCreate.length) return 0;

  await prisma.eventSlot.createMany({
    data: toCreate.map((o) => ({
      listingId: listing.id,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
    })),
  });
  return toCreate.length;
}

/** Projede všechny aktivní konzultace s pravidly a doplní chybějící sloty. */
export async function generateAllRecurringSlots(): Promise<number> {
  const listings = await prisma.eventListing.findMany({
    where: { kind: "consultation", active: true },
    select: {
      id: true,
      durationMinutes: true,
      recurringSlots: true,
      tenant: { select: { googleTimezone: true } },
    },
  });
  let created = 0;
  for (const l of listings) {
    created += await ensureRecurringSlots({
      id: l.id,
      durationMinutes: l.durationMinutes,
      recurringSlots: l.recurringSlots,
      timeZone: l.tenant.googleTimezone,
    }).catch(() => 0);
  }
  return created;
}

import { addMinutes, startOfDay, isBefore } from "date-fns";
import { prisma } from "./db";

export type Slot = {
  start: Date;
  end: Date;
};

const SLOT_STEP_MINUTES = 15;

/**
 * Vrátí volné sloty poskytovatele pro daný den a délku služby.
 * Bere v úvahu pracovní dobu, existující rezervace, TimeOff a buffer před/po.
 */
export async function getAvailableSlots(
  providerId: string,
  serviceDurationMinutes: number,
  date: Date,
  bufferBeforeMin = 0,
  bufferAfterMin = 0,
): Promise<Slot[]> {
  const dayStart = startOfDay(date);
  const weekday = dayStart.getDay();

  const workingHours = await prisma.workingHour.findMany({
    where: { providerId, weekday },
    orderBy: { startMin: "asc" },
  });
  if (workingHours.length === 0) return [];

  const dayEnd = addMinutes(dayStart, 24 * 60);
  const [bookings, timeOff] = await Promise.all([
    prisma.booking.findMany({
      where: {
        providerId,
        status: { not: "cancelled" },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({
      where: {
        providerId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const blocks = [...bookings, ...timeOff];

  const now = new Date();
  const slots: Slot[] = [];

  for (const wh of workingHours) {
    const windowStart = addMinutes(dayStart, wh.startMin);
    const windowEnd = addMinutes(dayStart, wh.endMin);

    let cursor = windowStart;
    while (
      !isBefore(
        windowEnd,
        addMinutes(cursor, serviceDurationMinutes),
      )
    ) {
      const slotEnd = addMinutes(cursor, serviceDurationMinutes);
      // Pro kolizní kontrolu rozšíříme okno o buffery
      const blockedStart = addMinutes(cursor, -bufferBeforeMin);
      const blockedEnd = addMinutes(slotEnd, bufferAfterMin);
      const overlaps = blocks.some(
        (b) =>
          isBefore(b.startsAt, blockedEnd) && isBefore(blockedStart, b.endsAt),
      );
      const inPast = isBefore(cursor, now);

      if (!overlaps && !inPast) {
        slots.push({ start: cursor, end: slotEnd });
      }
      cursor = addMinutes(cursor, SLOT_STEP_MINUTES);
    }
  }

  return slots;
}

/**
 * Ověří, že požadovaný čas je opravdu volný (proti race-conditions při souběžných rezervacích).
 */
export async function isSlotStillFree(
  providerId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<boolean> {
  const weekday = startsAt.getDay();
  const startMin = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMin = endsAt.getHours() * 60 + endsAt.getMinutes();

  const workingHours = await prisma.workingHour.findMany({
    where: { providerId, weekday },
  });
  const withinHours = workingHours.some(
    (wh) => wh.startMin <= startMin && wh.endMin >= endMin,
  );
  if (!withinHours) return false;

  const conflict = await prisma.booking.findFirst({
    where: {
      providerId,
      status: { not: "cancelled" },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (conflict) return false;

  const timeOff = await prisma.timeOff.findFirst({
    where: {
      providerId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  return !timeOff;
}

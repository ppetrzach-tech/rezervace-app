import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireIntegrationSecret } from "@/lib/integration";
import {
  BOOKING_FULL_INCLUDE,
  BookingConflictError,
  moveBooking,
} from "@/lib/booking-actions";

const schema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

/**
 * Přesun rezervace založené integrací. Stejná logika i e-mail klientovi jako
 * dashboardový přesun (sdílené moveBooking). Google Kalendář se NEsynchronizuje
 * (událost spravuje Tabidoo/Make).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { externalRef: string } },
) {
  const denied = requireIntegrationSecret(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { externalRef: decodeURIComponent(params.externalRef) },
    include: BOOKING_FULL_INCLUDE,
  });
  if (!booking) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "Zrušenou rezervaci nelze přeplánovat." },
      { status: 409 },
    );
  }

  const startsAt = new Date(parsed.data.startsAt);
  const durationMs = booking.listing
    ? booking.listing.durationMinutes * 60_000
    : booking.endsAt.getTime() - booking.startsAt.getTime();
  const endsAt = parsed.data.endsAt
    ? new Date(parsed.data.endsAt)
    : new Date(startsAt.getTime() + durationMs);
  if (startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Termín je v minulosti" }, { status: 400 });
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return NextResponse.json({ error: "endsAt musí být po startsAt" }, { status: 400 });
  }

  try {
    const { emailSent } = await moveBooking({
      booking,
      startsAt,
      endsAt,
      slotId: null,
      syncCalendar: false,
    });
    return NextResponse.json({ ok: true, bookingId: booking.id, emailSent });
  } catch (e) {
    if (e instanceof BookingConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}

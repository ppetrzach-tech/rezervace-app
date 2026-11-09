import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readIntegrationBody, requireIntegrationSecret } from "@/lib/integration";
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

  const body = await readIntegrationBody(req);
  if (body === undefined) {
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
  // Stejný termín → nic neměnit ani neposílat (Make volá move při každé úpravě aktivity).
  if (
    startsAt.getTime() === booking.startsAt.getTime() &&
    endsAt.getTime() === booking.endsAt.getTime()
  ) {
    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      emailSent: false,
      unchanged: true,
    });
  }
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
    return NextResponse.json({ ok: true, bookingId: booking.id, emailSent, unchanged: false });
  } catch (e) {
    if (e instanceof BookingConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}

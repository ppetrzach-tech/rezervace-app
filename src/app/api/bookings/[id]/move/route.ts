import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";
import {
  BOOKING_FULL_INCLUDE,
  BookingConflictError,
  moveBooking,
} from "@/lib/booking-actions";

const schema = z.object({ slotId: z.string().min(1) });

/**
 * Přeplánování vlastníkem/asistentem — PŘESUN rezervace na jiný termín na místě.
 * Zachová klienta, otázky i odpovědi; uvolní starý slot; přesune událost
 * v kalendáři; pošle klientovi JEDEN e-mail o novém termínu. Žádný duplikát.
 *
 * POST /api/bookings/[id]/move  body: { slotId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Chybí termín" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
    include: BOOKING_FULL_INCLUDE,
  });
  if (!booking) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }
  if (!canManage(session.user) && booking.providerId !== session.user.providerId) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "Zrušenou rezervaci nelze přeplánovat." },
      { status: 400 },
    );
  }
  if (!booking.listing) {
    return NextResponse.json(
      { error: "Rezervace nemá nemovitost." },
      { status: 400 },
    );
  }

  const slot = await prisma.eventSlot.findFirst({
    where: { id: parsed.data.slotId, listingId: booking.listing.id },
    include: { booking: true },
  });
  if (!slot) {
    return NextResponse.json({ error: "Termín nenalezen" }, { status: 404 });
  }
  if (slot.booking && slot.booking.id !== booking.id) {
    return NextResponse.json(
      { error: "Tento termín už je obsazený." },
      { status: 409 },
    );
  }
  if (slot.startsAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Termín už proběhl — vyberte budoucí." },
      { status: 400 },
    );
  }

  // PŘESUN na místě — mění se jen slot + časy; otázky/odpovědi zůstávají.
  try {
    await moveBooking({
      booking,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      slotId: slot.id,
      syncCalendar: true,
    });
  } catch (e) {
    if (e instanceof BookingConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}

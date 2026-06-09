import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Stažení kalendářové události (.ics) pro danou rezervaci.
 * Spouští se až po kliknutí klienta na "Přidat do kalendáře" → žádná
 * automatická RSVP tlačítka v emailu.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  // Ukázkový odkaz z testovacího emailu
  if (params.token === "UKAZKA-TOKEN") {
    const now = new Date();
    const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const ics = generateIcs({
      uid: `ukazka-${now.getTime()}@rezervace`,
      title: "Ukázková prohlídka",
      startsAt: start,
      endsAt: end,
    });
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="schuzka.ics"',
      },
    });
  }

  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: params.token },
    include: { service: true, listing: true, provider: true, tenant: true },
  });

  if (!booking) {
    return new NextResponse("Rezervace nenalezena", { status: 404 });
  }

  const ics = generateIcs({
    uid: `booking-${booking.id}@rezervace`,
    title: `${booking.listing?.title || booking.service.name} — ${booking.tenant.name}`,
    description: booking.note ?? undefined,
    location:
      booking.listing?.address ?? booking.service.locationDetail ?? undefined,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    organizerName: booking.tenant.name,
    organizerEmail: booking.provider.email ?? undefined,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schuzka.ics"',
    },
  });
}

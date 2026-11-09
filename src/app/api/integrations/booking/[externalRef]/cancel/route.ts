import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireIntegrationSecret } from "@/lib/integration";
import { BOOKING_FULL_INCLUDE, cancelBooking } from "@/lib/booking-actions";

const schema = z.object({ reason: z.string().max(500).optional() });

/**
 * Zrušení rezervace založené integrací. Stejná logika i e-mail klientovi jako
 * dashboardové zrušení (sdílené cancelBooking). Opakované volání je bezpečné.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { externalRef: string } },
) {
  const denied = requireIntegrationSecret(req);
  if (denied) return denied;

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    /* prázdné tělo je v pořádku */
  }
  const parsed = schema.safeParse(raw ?? {});
  const reason = parsed.success ? parsed.data.reason?.trim() : undefined;

  const booking = await prisma.booking.findUnique({
    where: { externalRef: decodeURIComponent(params.externalRef) },
    include: BOOKING_FULL_INCLUDE,
  });
  if (!booking) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      clientEmailed: false,
      alreadyCancelled: true,
    });
  }

  const { clientEmailed } = await cancelBooking({
    booking,
    action: "cancel",
    logLabelSuffix: reason ? `(Tabidoo: ${reason})` : "(Tabidoo)",
  });
  return NextResponse.json({
    ok: true,
    bookingId: booking.id,
    clientEmailed,
    alreadyCancelled: false,
  });
}

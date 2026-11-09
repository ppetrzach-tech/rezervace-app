import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";
import { BOOKING_FULL_INCLUDE, cancelBooking } from "@/lib/booking-actions";

const schema = z.object({ action: z.enum(["cancel", "reschedule"]).optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  let parsedBody: unknown = {};
  try {
    parsedBody = await req.json();
  } catch {
    /* prázdné tělo = výchozí "cancel" */
  }
  const p = schema.safeParse(parsedBody);
  const action = (p.success && p.data.action) || "cancel";

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: BOOKING_FULL_INCLUDE,
  });
  if (!booking) {
    return NextResponse.json({ error: "Rezervace neexistuje" }, { status: 404 });
  }
  if (booking.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }

  // Owner i manažer (staff bez providerId) smí rušit vše;
  // staff vázaný na providera jen své rezervace.
  const providerId = session.user.providerId;
  if (!canManage(session.user) && booking.providerId !== providerId) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }

  // Zrušení + uvolnění slotu + stop dalších e-mailů + kalendář + e-mail klientovi
  const { clientEmailed } = await cancelBooking({ booking, action });

  return NextResponse.json({ ok: true, action, clientEmailed });
}

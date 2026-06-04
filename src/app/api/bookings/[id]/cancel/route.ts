import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { canManage } from "@/lib/perms";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
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

  await prisma.booking.update({
    where: { id: params.id },
    data: { status: "cancelled" },
  });

  // Smažeme i událost v Google Calendar (pokud byla vytvořena)
  if (booking.googleEventId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: booking.tenantId },
    });
    if (tenant?.googleCalendarId) {
      const res = await deleteCalendarEvent(
        tenant.googleCalendarId,
        booking.googleEventId,
      );
      if (!res.ok) {
        console.warn("[cancel] Google Calendar delete failed:", res.error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

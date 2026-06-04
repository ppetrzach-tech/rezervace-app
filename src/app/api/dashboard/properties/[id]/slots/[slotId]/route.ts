import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; slotId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;
  const slot = await prisma.eventSlot.findUnique({
    where: { id: params.slotId },
    include: { listing: true, booking: true },
  });
  if (!slot || slot.listing.tenantId !== tenantId || slot.listingId !== params.id) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  if (slot.booking) {
    return NextResponse.json(
      { error: "Slot už má rezervaci. Nejdřív rezervaci zrušte." },
      { status: 400 },
    );
  }
  await prisma.eventSlot.delete({ where: { id: slot.id } });
  return NextResponse.json({ ok: true });
}

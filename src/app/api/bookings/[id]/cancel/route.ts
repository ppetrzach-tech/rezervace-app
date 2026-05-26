import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  const role = session.user.role;
  const providerId = session.user.providerId;
  if (role !== "owner" && booking.providerId !== providerId) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }

  await prisma.booking.update({
    where: { id: params.id },
    data: { status: "cancelled" },
  });
  return NextResponse.json({ ok: true });
}

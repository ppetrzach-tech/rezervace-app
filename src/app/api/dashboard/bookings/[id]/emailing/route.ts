import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";

const schema = z.object({ stopped: z.boolean() });

/** Zapne/vypne další automatické emaily pro rezervaci. POST /api/dashboard/bookings/[id]/emailing */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const booking = await prisma.booking.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  });
  if (!booking) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

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

  await prisma.booking.update({
    where: { id: params.id },
    data: { emailingStopped: parsed.data.stopped },
  });
  return NextResponse.json({ ok: true, stopped: parsed.data.stopped });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";

const schema = z.object({ active: z.boolean() });

/** Rychlé přepnutí aktivní/neaktivní. POST /api/dashboard/properties/[id]/toggle-active */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const own = await prisma.eventListing.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
  });
  if (!own) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

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

  await prisma.eventListing.update({
    where: { id: params.id },
    data: { active: parsed.data.active },
  });
  return NextResponse.json({ ok: true, active: parsed.data.active });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().default(""),
  bio: z.string().max(500).optional().default(""),
  photoUrl: z.string().max(1000).optional().default(""),
  active: z.boolean().default(true),
});

async function ensureOwn(tenantId: string, id: string) {
  return prisma.provider.findFirst({ where: { id, tenantId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;
  const own = await ensureOwn(tenantId, params.id);
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
  const data = parsed.data;

  await prisma.provider.update({
    where: { id: params.id },
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      bio: data.bio || null,
      photoUrl: data.photoUrl?.trim() || null,
      active: data.active,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;
  const own = await ensureOwn(tenantId, params.id);
  if (!own) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  await prisma.provider.update({
    where: { id: params.id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}

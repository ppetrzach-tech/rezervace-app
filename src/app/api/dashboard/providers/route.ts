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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;

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

  const provider = await prisma.provider.create({
    data: {
      tenantId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      bio: data.bio || null,
      photoUrl: data.photoUrl?.trim() || null,
      active: data.active,
    },
  });
  // Default pracovní doba Po–Pá 9–17
  for (let wd = 1; wd <= 5; wd++) {
    await prisma.workingHour.create({
      data: {
        providerId: provider.id,
        weekday: wd,
        startMin: 9 * 60,
        endMin: 17 * 60,
      },
    });
  }
  return NextResponse.json({ ok: true, id: provider.id });
}

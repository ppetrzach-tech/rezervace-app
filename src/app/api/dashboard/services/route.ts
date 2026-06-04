import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().default(""),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  priceCzk: z.number().int().min(0).default(0),
  showPrice: z.boolean().default(true),
  locationType: z.enum(["in_person", "online", "phone", "custom"]),
  locationDetail: z.string().max(500).optional().default(""),
  bufferBeforeMin: z.number().int().min(0).max(480).default(0),
  bufferAfterMin: z.number().int().min(0).max(480).default(0),
  active: z.boolean().default(true),
  providerIds: z.array(z.string()).default([]),
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

  // Validace, že všichni providerIds patří k tomuto tenantovi
  if (data.providerIds.length > 0) {
    const count = await prisma.provider.count({
      where: { id: { in: data.providerIds }, tenantId },
    });
    if (count !== data.providerIds.length) {
      return NextResponse.json({ error: "Některé osoby nepatří k vám" }, { status: 400 });
    }
  }

  const service = await prisma.service.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description || null,
      durationMinutes: data.durationMinutes,
      priceCzk: data.priceCzk,
      showPrice: data.showPrice,
      locationType: data.locationType,
      locationDetail: data.locationDetail || null,
      bufferBeforeMin: data.bufferBeforeMin,
      bufferAfterMin: data.bufferAfterMin,
      active: data.active,
      providers: {
        create: data.providerIds.map((providerId) => ({ providerId })),
      },
    },
  });

  return NextResponse.json({ ok: true, id: service.id });
}

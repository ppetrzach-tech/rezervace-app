import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

async function ensureOwn(tenantId: string, id: string) {
  return prisma.service.findFirst({ where: { id, tenantId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
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

  if (data.providerIds.length > 0) {
    const count = await prisma.provider.count({
      where: { id: { in: data.providerIds }, tenantId },
    });
    if (count !== data.providerIds.length) {
      return NextResponse.json({ error: "Některé osoby nepatří k vám" }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.service.update({
      where: { id: params.id },
      data: {
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
      },
    }),
    prisma.serviceProvider.deleteMany({ where: { serviceId: params.id } }),
    ...(data.providerIds.length > 0
      ? [
          prisma.serviceProvider.createMany({
            data: data.providerIds.map((providerId) => ({
              serviceId: params.id,
              providerId,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;
  const own = await ensureOwn(tenantId, params.id);
  if (!own) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  // Místo skutečného smazání jen deaktivujeme (zachováme historii rezervací)
  await prisma.service.update({
    where: { id: params.id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}

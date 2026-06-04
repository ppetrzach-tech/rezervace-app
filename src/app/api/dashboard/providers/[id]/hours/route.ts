import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";

const schema = z.object({
  hours: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      startMin: z.number().int().min(0).max(24 * 60),
      endMin: z.number().int().min(0).max(24 * 60),
    }),
  ),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }
  const tenantId = session.user.tenantId;

  const provider = await prisma.provider.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!provider) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  // Owner/manažer může editovat všechny hodiny; provider-staff jen vlastní
  if (!canManage(session.user) && session.user.providerId !== provider.id) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }

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
  for (const h of parsed.data.hours) {
    if (h.endMin <= h.startMin) {
      return NextResponse.json(
        { error: "Konec pracovní doby musí být po začátku." },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction([
    prisma.workingHour.deleteMany({ where: { providerId: provider.id } }),
    ...(parsed.data.hours.length > 0
      ? [
          prisma.workingHour.createMany({
            data: parsed.data.hours.map((h) => ({
              providerId: provider.id,
              weekday: h.weekday,
              startMin: h.startMin,
              endMin: h.endMin,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}

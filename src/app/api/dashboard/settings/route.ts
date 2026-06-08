import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSlugReserved, slugify } from "@/lib/tenant";

const schema = z.object({
  slug: z.string().min(2).max(50),
  name: z.string().min(2).max(120),
  tagline: z.string().max(200).optional().default(""),
  primaryColor: z.string().regex(/^[0-9a-fA-F]{6}$/),
  ownerPhone: z.string().max(40).optional().default(""),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
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

  const slug = slugify(data.slug);
  if (!slug || isSlugReserved(slug)) {
    return NextResponse.json(
      { error: "Tento název URL není povolen." },
      { status: 400 },
    );
  }

  // Pokud měníme slug, zkontrolovat unikátnost
  if (slug !== (await prisma.tenant.findUnique({ where: { id: tenantId } }))?.slug) {
    const exists = await prisma.tenant.findUnique({ where: { slug } });
    if (exists) {
      return NextResponse.json({ error: "Tato URL je obsazená." }, { status: 409 });
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      slug,
      name: data.name,
      tagline: data.tagline || null,
      primaryColor: data.primaryColor.toLowerCase(),
      ownerPhone: data.ownerPhone || null,
    },
  });

  return NextResponse.json({ ok: true });
}

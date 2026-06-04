import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/tenant";
import { canManage } from "@/lib/perms";

const schema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(60),
  address: z.string().max(300).optional().default(""),
  description: z.string().max(2000).optional().default(""),
  durationMinutes: z.number().int().min(5).max(8 * 60),
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

  const slug = slugify(data.slug);
  if (!slug) {
    return NextResponse.json({ error: "Neplatný slug" }, { status: 400 });
  }

  const exists = await prisma.eventListing.findFirst({
    where: { tenantId, slug },
  });
  if (exists) {
    return NextResponse.json({ error: "Slug už existuje" }, { status: 409 });
  }

  const listing = await prisma.eventListing.create({
    data: {
      tenantId,
      slug,
      title: data.title,
      address: data.address || null,
      description: data.description || null,
      durationMinutes: data.durationMinutes,
    },
  });
  return NextResponse.json({ ok: true, id: listing.id });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/tenant";

const questionSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "textarea", "yesno", "select", "number"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

const schema = z.object({
  slug: z.string().min(1).max(60),
  title: z.string().min(1).max(200),
  address: z.string().max(300).optional().default(""),
  description: z.string().max(2000).optional().default(""),
  durationMinutes: z.number().int().min(5).max(8 * 60),
  providerId: z.string().nullable(),
  active: z.boolean(),
  formQuestions: z.array(questionSchema),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;

  const own = await prisma.eventListing.findFirst({
    where: { id: params.id, tenantId },
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
  const data = parsed.data;

  const slug = slugify(data.slug);
  if (!slug) {
    return NextResponse.json({ error: "Neplatný slug" }, { status: 400 });
  }

  if (slug !== own.slug) {
    const exists = await prisma.eventListing.findFirst({
      where: { tenantId, slug, NOT: { id: params.id } },
    });
    if (exists) return NextResponse.json({ error: "Slug obsazený" }, { status: 409 });
  }

  if (data.providerId) {
    const p = await prisma.provider.findFirst({
      where: { id: data.providerId, tenantId },
    });
    if (!p) return NextResponse.json({ error: "Osoba nepatří k vám" }, { status: 400 });
  }

  await prisma.eventListing.update({
    where: { id: params.id },
    data: {
      slug,
      title: data.title,
      description: data.description || null,
      address: data.address || null,
      durationMinutes: data.durationMinutes,
      providerId: data.providerId,
      active: data.active,
      formQuestions: data.formQuestions,
    },
  });

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
  const own = await prisma.eventListing.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!own) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  await prisma.eventListing.update({
    where: { id: params.id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}

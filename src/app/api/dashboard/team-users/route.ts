import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  // volitelně napojit na providera (pak vidí jen jeho rezervace)
  providerId: z.string().nullable().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    where: { tenantId: session.user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      providerId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data (heslo min. 8 znaků, platný email)" },
      { status: 400 },
    );
  }
  const { name, email, password, providerId } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  // Email musí být globálně unikátní
  const exists = await prisma.user.findUnique({ where: { email: emailLower } });
  if (exists) {
    return NextResponse.json(
      { error: "Uživatel s tímto emailem už existuje." },
      { status: 409 },
    );
  }

  // Pokud je providerId, ověř že patří k tomuto tenantovi a není už obsazený
  if (providerId) {
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, tenantId: session.user.tenantId },
      include: { user: true },
    });
    if (!provider) {
      return NextResponse.json({ error: "Osoba nepatří k vám" }, { status: 400 });
    }
    if (provider.user) {
      return NextResponse.json(
        { error: "Tato osoba už má přiřazený login." },
        { status: 409 },
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      tenantId: session.user.tenantId,
      name,
      email: emailLower,
      passwordHash,
      role: "staff",
      providerId: providerId || null,
    },
  });

  return NextResponse.json({ ok: true });
}

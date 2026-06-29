import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isSlugReserved, slugify } from "@/lib/tenant";

const schema = z.object({
  businessName: z.string().min(2).max(120),
  slug: z.string().min(2).max(50),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(10)
    .max(200)
    .regex(/\p{L}/u, "Heslo musí obsahovat písmeno")
    .regex(/\d/, "Heslo musí obsahovat číslo"),
  inviteCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const expectedCode = process.env.INVITE_CODE;
  if (!expectedCode) {
    return NextResponse.json(
      { error: "Registrace zatím není aktivní. Kontaktujte správce." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatné údaje", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.inviteCode !== expectedCode) {
    return NextResponse.json(
      { error: "Neplatný pozvánkový kód." },
      { status: 403 },
    );
  }

  const slug = slugify(data.slug);
  if (!slug || isSlugReserved(slug)) {
    return NextResponse.json(
      { error: "Tento název URL není povolen, zvolte jiný." },
      { status: 400 },
    );
  }

  const exists = await prisma.tenant.findUnique({ where: { slug } });
  if (exists) {
    return NextResponse.json(
      { error: "Tato URL je už obsazená, zvolte jinou." },
      { status: 409 },
    );
  }

  const emailLower = data.email.toLowerCase();
  const userExists = await prisma.user.findUnique({ where: { email: emailLower } });
  if (userExists) {
    return NextResponse.json(
      { error: "Tento email už je registrovaný." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  // Vytvoření tenanta + ownera + jeho providera (osoba) v jedné transakci
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: data.businessName,
      tagline: "Rezervujte si termín online",
      primaryColor: "2563eb",
    },
  });

  const provider = await prisma.provider.create({
    data: {
      tenantId: tenant.id,
      name: data.name,
      email: emailLower,
      bio: "",
    },
  });

  // Výchozí pracovní doba Po–Pá 9:00–17:00
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

  await prisma.user.create({
    data: {
      email: emailLower,
      passwordHash,
      name: data.name,
      role: "owner",
      tenantId: tenant.id,
      providerId: provider.id,
    },
  });

  return NextResponse.json({
    ok: true,
    tenant: { slug: tenant.slug, name: tenant.name },
  });
}

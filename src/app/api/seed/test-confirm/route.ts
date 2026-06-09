import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";

/**
 * Diagnostika potvrzovacího tlačítka: vytvoří dočasnou rezervaci s tokenem,
 * skutečně zavolá confirm URL (jako klient kliknutím v emailu) a ověří,
 * že se confirmedByClientAt zapsalo do DB. Pak uklidí.
 *
 * GET /api/seed/test-confirm?secret=<SEED_SECRET>
 */
export async function GET(req: NextRequest) {
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret) {
    return NextResponse.json({ error: "SEED_SECRET není nastaven" }, { status: 503 });
  }
  if (new URL(req.url).searchParams.get("secret") !== seedSecret) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app";

  // Dočasný tenant + minimální data
  await prisma.tenant.deleteMany({ where: { slug: "confirm-test" } });
  const tenant = await prisma.tenant.create({
    data: { slug: "confirm-test", name: "Confirm Test", primaryColor: "2563eb" },
  });
  const provider = await prisma.provider.create({
    data: { tenantId: tenant.id, name: "Test", email: "t@example.com" },
  });
  const service = await prisma.service.create({
    data: {
      tenantId: tenant.id,
      name: "Prohlídka",
      durationMinutes: 30,
      priceCzk: 0,
      locationType: "custom",
    },
  });
  const client = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      name: "Test Klient",
      email: "test@example.com",
      phone: "+420777000000",
    },
  });
  const token = randomBytes(16).toString("hex");
  const now = new Date();
  const booking = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      providerId: provider.id,
      startsAt: addMinutes(now, 60),
      endsAt: addMinutes(now, 90),
      confirmationToken: token,
    },
  });

  const confirmUrl = `${baseUrl}/booking/confirm/${token}`;

  // Stav PŘED kliknutím
  const before = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: { confirmedByClientAt: true },
  });

  // Simulace kliknutí klienta v emailu — skutečné GET na confirm URL
  let httpStatus = 0;
  let fetchError: string | null = null;
  try {
    const res = await fetch(confirmUrl, { method: "GET" });
    httpStatus = res.status;
  } catch (e) {
    fetchError = String(e);
  }

  // Stav PO kliknutí
  const after = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: { confirmedByClientAt: true },
  });

  // Úklid
  await prisma.tenant.deleteMany({ where: { slug: "confirm-test" } });

  return NextResponse.json({
    confirmUrl,
    httpStatus,
    fetchError,
    confirmedBefore: before?.confirmedByClientAt ?? null,
    confirmedAfter: after?.confirmedByClientAt ?? null,
    vysledek:
      after?.confirmedByClientAt && !before?.confirmedByClientAt
        ? "✅ FUNGUJE — kliknutí na URL zapsalo potvrzení do DB"
        : "❌ NEFUNGUJE — potvrzení se nezapsalo",
  });
}

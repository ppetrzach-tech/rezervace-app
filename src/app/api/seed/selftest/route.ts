import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import { processNotifications } from "@/lib/notification-engine";
import { PUBLIC_BASE_URL } from "@/lib/base-url";

/**
 * End-to-end self-test celého notifikačního řetězce.
 *
 * GET /api/seed/selftest?secret=<SEED_SECRET>&clientEmail=vas@email.cz
 *
 * Co dělá:
 *  1. Vytvoří dočasný tenant "selftest" s nemovitostí (30 min prohlídka) + odkazy
 *  2. Nahraje 2 notifikační pravidla:
 *       - "24 h před" (s confirm tlačítkem + .ics)
 *       - "+10 min po konci"
 *  3. Vytvoří 2 rezervace:
 *       A) prohlídka skončila před 10 min  → "+10 po konci" je DUE TEĎ
 *       B) prohlídka začíná za ~24 h        → "24 h před" je DUE TEĎ
 *  4. Spustí notifikační engine
 *  5. Automaticky klikne na confirm odkaz u rezervace B (simuluje klienta)
 *  6. Vrátí přehled: co se odeslalo, stav potvrzení, log
 *
 * Pokud zadáte clientEmail, skutečné emaily dorazí na něj (uvidíte je ve schránce).
 */
export async function GET(req: NextRequest) {
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret) {
    return NextResponse.json({ error: "SEED_SECRET není nastaven" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== seedSecret) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const clientEmail = (searchParams.get("clientEmail") || "test@example.com")
    .toLowerCase()
    .trim();
  const baseUrl = PUBLIC_BASE_URL;

  // 1) Čistý tenant
  await prisma.tenant.deleteMany({ where: { slug: "selftest" } });
  const tenant = await prisma.tenant.create({
    data: {
      slug: "selftest",
      name: "Self-test realitka",
      tagline: "Testovací účet",
      primaryColor: "2563eb",
      ownerEmail: clientEmail,
      replyToEmail: clientEmail,
    },
  });

  const provider = await prisma.provider.create({
    data: {
      tenantId: tenant.id,
      name: "Tester Makléř",
      email: clientEmail,
      phone: "724 191 620",
    },
  });

  const listing = await prisma.eventListing.create({
    data: {
      tenantId: tenant.id,
      slug: "testovaci-byt",
      title: "Testovací byt 3+kk, Praha 7",
      address: "Strojnická 12, Praha 7",
      durationMinutes: 30,
      providerId: provider.id,
      documentsUrl: "https://drive.google.com/test-slozka",
      virtualTourUrl: "https://my.matterport.com/test",
      propertyWebUrl: "https://www.sreality.cz/test",
      offerFormUrl: "https://forms.gle/test",
      active: true,
    },
  });

  // 2) Pravidla
  await prisma.notificationRule.create({
    data: {
      tenantId: tenant.id,
      name: "24 h před (test)",
      channel: "email",
      offsetMinutes: -24 * 60,
      subject: "Potvrzení prohlídky {{service_name}}",
      body:
        "Dobrý den {{client_first_name}},\n\npotvrzuji prohlídku {{service_name}} na {{location}}.\nProsím potvrďte tlačítkem níže.\n\nDokumenty: [📂 Složka]({{documents_url}})",
      includeIcs: true,
      includeConfirmButton: true,
      onlyIfNotConfirmed: false,
      enabled: true,
    },
  });
  await prisma.notificationRule.create({
    data: {
      tenantId: tenant.id,
      name: "+10 min po konci (test)",
      channel: "email",
      offsetMinutes: 10,
      subject: "Děkuji za Váš čas",
      body:
        "Dobrý den {{client_first_name}},\n\nděkuji za prohlídku {{service_name}}.\nNabídkový formulář: [📝 Odeslat nabídku]({{offer_form_url}})",
      includeIcs: false,
      includeConfirmButton: false,
      onlyIfNotConfirmed: false,
      enabled: true,
    },
  });

  // 3) Klient
  const client = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      name: "Marie Testovací",
      email: clientEmail,
      phone: "+420777123456",
    },
  });

  const service = await prisma.service.create({
    data: {
      tenantId: tenant.id,
      name: "Prohlídka",
      durationMinutes: 30,
      priceCzk: 0,
      showPrice: false,
      locationType: "custom",
      active: true,
    },
  });

  const now = new Date();

  // Rezervace A — prohlídka 40 min zpět začala, 10 min zpět skončila (30 min)
  // → "+10 min po konci" má vyjít TEĎ
  const aStart = addMinutes(now, -40);
  const aEnd = addMinutes(now, -10);
  const bookingA = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      providerId: provider.id,
      listingId: listing.id,
      startsAt: aStart,
      endsAt: aEnd,
      confirmationToken: randomBytes(16).toString("hex"),
    },
  });

  // Rezervace B — začíná za ~24 h (23h50m) → "24 h před" má vyjít TEĎ
  const bStart = addMinutes(now, 24 * 60 - 10);
  const bEnd = addMinutes(bStart, 30);
  const bToken = randomBytes(16).toString("hex");
  const bookingB = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      serviceId: service.id,
      providerId: provider.id,
      listingId: listing.id,
      startsAt: bStart,
      endsAt: bEnd,
      confirmationToken: bToken,
    },
  });

  // 4) Spustit engine
  const engineResult = await processNotifications();

  // 5) Simulovat kliknutí na confirm u rezervace B
  await prisma.booking.update({
    where: { id: bookingB.id },
    data: { confirmedByClientAt: new Date() },
  });

  // 6) Načíst log
  const [logsA, logsB, confirmedB] = await Promise.all([
    prisma.notificationLog.findMany({ where: { bookingId: bookingA.id } }),
    prisma.notificationLog.findMany({ where: { bookingId: bookingB.id } }),
    prisma.booking.findUnique({ where: { id: bookingB.id } }),
  ]);

  return NextResponse.json({
    ok: true,
    poznamka:
      clientEmail === "test@example.com"
        ? "Emaily šly na test@example.com (nedorazí). Zadejte ?clientEmail=vas@email.cz pro skutečný test."
        : `Emaily byly odeslány na ${clientEmail} — zkontrolujte schránku (i spam).`,
    engine: engineResult,
    rezervaceA_poProhlidce: {
      popis: "Prohlídka skončila před 10 min → měl vyjít email '+10 min po konci'",
      zacatek: aStart.toISOString(),
      konec: aEnd.toISOString(),
      odeslane_notifikace: logsA.map((l) => ({ kanal: l.channel, stav: l.status, chyba: l.error })),
    },
    rezervaceB_pred24h: {
      popis: "Začíná za ~24 h → měl vyjít email '24 h před' s potvrzovacím tlačítkem",
      zacatek: bStart.toISOString(),
      odeslane_notifikace: logsB.map((l) => ({ kanal: l.channel, stav: l.status, chyba: l.error })),
      confirm_url: `${baseUrl}/booking/confirm/${bToken}`,
      potvrzeno_klientem: !!confirmedB?.confirmedByClientAt,
    },
    uklid:
      "Testovací tenant 'selftest' zůstává v DB. Smažete přes /api/seed/selftest/cleanup?secret=...",
  });
}

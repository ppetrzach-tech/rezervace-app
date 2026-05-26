import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Jednorázový seed endpoint pro produkci.
 *
 * Použití:
 *   GET /api/seed?secret=<SEED_SECRET>&preset=salon|realitka|konzultant
 *
 * Vytvoří jednoho testovacího tenanta s daty podle presetu.
 * Pokud tenant se stejným slugem existuje, smaže ho a vytvoří znovu.
 */
export async function GET(req: NextRequest) {
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret) {
    return NextResponse.json(
      { error: "SEED_SECRET není nastaven — endpoint je vypnutý." },
      { status: 503 },
    );
  }
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== seedSecret) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const preset = (searchParams.get("preset") || "salon").toLowerCase();

  // Mapování preset → konfigurace tenanta
  const presetConfig: Record<
    string,
    { slug: string; name: string; tagline: string; primaryColor: string }
  > = {
    salon: {
      slug: "salon-krasy",
      name: "Salon Krásy",
      tagline: "Rezervujte si termín online",
      primaryColor: "db2777",
    },
    realitka: {
      slug: "reality-novak",
      name: "Reality Novák",
      tagline: "Domluvte si prohlídku nebo konzultaci",
      primaryColor: "16a34a",
    },
    konzultant: {
      slug: "martin-konzultant",
      name: "Martin Konzultant",
      tagline: "Vyberte si termín konzultace",
      primaryColor: "2563eb",
    },
  };

  const cfg = presetConfig[preset] || presetConfig.salon;

  // Smazat existujícího tenanta se stejným slugem (cascade smaže vše)
  await prisma.tenant.deleteMany({ where: { slug: cfg.slug } });

  const tenant = await prisma.tenant.create({
    data: {
      slug: cfg.slug,
      name: cfg.name,
      tagline: cfg.tagline,
      primaryColor: cfg.primaryColor,
    },
  });

  async function createHours(providerId: string, weekdays: number[], h1: number, h2: number) {
    for (const wd of weekdays) {
      await prisma.workingHour.create({
        data: { providerId, weekday: wd, startMin: h1 * 60, endMin: h2 * 60 },
      });
    }
  }

  let providers: Array<{ id: string; name: string; email: string | null }> = [];

  if (preset === "realitka") {
    const jana = await prisma.provider.create({
      data: {
        tenantId: tenant.id,
        name: "Jana Realitní",
        email: "jana@example.com",
        phone: "+420777111222",
        bio: "Realitní makléřka, specializace na Prahu 6 a okolí.",
      },
    });
    const tomas = await prisma.provider.create({
      data: {
        tenantId: tenant.id,
        name: "Tomáš Investiční",
        email: "tomas@example.com",
        phone: "+420777333444",
        bio: "Investiční nemovitosti, komerční prostory.",
      },
    });
    const prohlidka = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Prohlídka nemovitosti",
        description: "Osobní prohlídka konkrétní nabídky.",
        durationMinutes: 45,
        priceCzk: 0,
        showPrice: false,
        locationType: "custom",
        locationDetail: "Adresa nemovitosti vám bude zaslána emailem.",
        bufferBeforeMin: 30,
        bufferAfterMin: 30,
      },
    });
    const konzultace = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Úvodní konzultace (zdarma)",
        description: "30 minut online — probereme vaše požadavky.",
        durationMinutes: 30,
        priceCzk: 0,
        showPrice: false,
        locationType: "online",
        locationDetail: "Odkaz na Google Meet vám bude zaslán emailem.",
      },
    });
    const ocenovani = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Ocenění nemovitosti",
        description: "Návštěva u vás, prohlídka a odhad tržní ceny.",
        durationMinutes: 60,
        priceCzk: 0,
        showPrice: false,
        locationType: "custom",
        locationDetail: "U klienta — adresa upřesněna po objednání.",
        bufferBeforeMin: 30,
        bufferAfterMin: 30,
      },
    });
    await prisma.serviceProvider.createMany({
      data: [
        { serviceId: prohlidka.id, providerId: jana.id },
        { serviceId: konzultace.id, providerId: jana.id },
        { serviceId: ocenovani.id, providerId: jana.id },
        { serviceId: prohlidka.id, providerId: tomas.id },
        { serviceId: konzultace.id, providerId: tomas.id },
      ],
    });
    for (const p of [jana, tomas]) {
      await createHours(p.id, [1, 2, 3, 4, 5], 9, 18);
      await createHours(p.id, [6], 10, 14);
    }
    providers = [jana, tomas];
  } else if (preset === "konzultant") {
    const martin = await prisma.provider.create({
      data: {
        tenantId: tenant.id,
        name: "Martin Konzultant",
        email: "martin@example.com",
        phone: "+420777111222",
        bio: "Business konzultant, mentor pro startupy a freelancery.",
      },
    });
    const intro = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Úvodní hovor (15 min, zdarma)",
        description: "Krátké představení a posouzení, zda si vzájemně sedneme.",
        durationMinutes: 15,
        priceCzk: 0,
        showPrice: false,
        locationType: "online",
        locationDetail: "Google Meet odkaz dorazí emailem.",
        bufferAfterMin: 5,
      },
    });
    const konzultace = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Hodinová konzultace",
        description: "60 minut na konkrétní problém.",
        durationMinutes: 60,
        priceCzk: 2500,
        locationType: "online",
        locationDetail: "Google Meet odkaz dorazí emailem.",
        bufferAfterMin: 10,
      },
    });
    const mentoring = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Mentoring session",
        description: "90 minut hlubšího mentoringu.",
        durationMinutes: 90,
        priceCzk: 3500,
        locationType: "online",
        locationDetail: "Google Meet odkaz dorazí emailem.",
        bufferAfterMin: 15,
      },
    });
    await prisma.serviceProvider.createMany({
      data: [
        { serviceId: intro.id, providerId: martin.id },
        { serviceId: konzultace.id, providerId: martin.id },
        { serviceId: mentoring.id, providerId: martin.id },
      ],
    });
    await createHours(martin.id, [1, 2, 3, 4, 5], 10, 18);
    providers = [martin];
  } else {
    const anna = await prisma.provider.create({
      data: {
        tenantId: tenant.id,
        name: "Anna Nováková",
        email: "anna@example.com",
        phone: "+420777111222",
        bio: "Kadeřnice s 10letou praxí. Specialistka na barvení.",
      },
    });
    const petr = await prisma.provider.create({
      data: {
        tenantId: tenant.id,
        name: "Petr Svoboda",
        email: "petr@example.com",
        phone: "+420777333444",
        bio: "Barber a holič. Klasické i moderní střihy.",
      },
    });
    const strih = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Dámský střih",
        description: "Mytí, střih a foukaná.",
        durationMinutes: 60,
        priceCzk: 690,
        locationType: "in_person",
        locationDetail: "Salon, Národní 25, Praha 1",
        bufferAfterMin: 15,
      },
    });
    const barveni = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Barvení vlasů",
        description: "Profesionální barvení včetně mytí a foukané.",
        durationMinutes: 120,
        priceCzk: 1490,
        locationType: "in_person",
        locationDetail: "Salon, Národní 25, Praha 1",
        bufferAfterMin: 15,
      },
    });
    const pansky = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: "Pánský střih",
        description: "Klasický nebo moderní pánský střih.",
        durationMinutes: 45,
        priceCzk: 450,
        locationType: "in_person",
        locationDetail: "Salon, Národní 25, Praha 1",
        bufferAfterMin: 15,
      },
    });
    await prisma.serviceProvider.createMany({
      data: [
        { serviceId: strih.id, providerId: anna.id },
        { serviceId: barveni.id, providerId: anna.id },
        { serviceId: pansky.id, providerId: petr.id },
        { serviceId: strih.id, providerId: petr.id },
      ],
    });
    for (const p of [anna, petr]) {
      await createHours(p.id, [1, 2, 3, 4, 5], 9, 17);
    }
    providers = [anna, petr];
  }

  // Admin user
  const passwordHash = await bcrypt.hash("heslo123", 10);
  const ownerEmail = `owner-${cfg.slug}@example.com`;
  await prisma.user.deleteMany({ where: { email: ownerEmail } });
  await prisma.user.create({
    data: {
      email: ownerEmail,
      passwordHash,
      name: `Vlastník ${cfg.name}`,
      role: "owner",
      tenantId: tenant.id,
    },
  });

  return NextResponse.json({
    ok: true,
    preset,
    tenant: {
      slug: cfg.slug,
      url: `/${cfg.slug}`,
    },
    providersCreated: providers.length,
    login: {
      owner: ownerEmail,
      password: "heslo123",
    },
  });
}

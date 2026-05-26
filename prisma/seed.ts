import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Šablona určuje, jaká testovací data se naplní.
 * Změňte v .env: SEED_PRESET=salon|realitka|konzultant
 */
const PRESET = (process.env.SEED_PRESET || "salon").toLowerCase();

async function wipe() {
  await prisma.booking.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.workingHour.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.service.deleteMany();
}

async function createWorkingHours(
  providerId: string,
  weekdays: number[],
  startHour: number,
  endHour: number,
) {
  for (const wd of weekdays) {
    await prisma.workingHour.create({
      data: {
        providerId,
        weekday: wd,
        startMin: startHour * 60,
        endMin: endHour * 60,
      },
    });
  }
}

async function seedSalon() {
  const anna = await prisma.provider.create({
    data: {
      name: "Anna Nováková",
      email: "anna@salonkrasy.cz",
      phone: "+420777111222",
      bio: "Kadeřnice s 10letou praxí. Specialistka na barvení.",
    },
  });
  const petr = await prisma.provider.create({
    data: {
      name: "Petr Svoboda",
      email: "petr@salonkrasy.cz",
      phone: "+420777333444",
      bio: "Barber a holič. Klasické i moderní střihy.",
    },
  });

  const strih = await prisma.service.create({
    data: {
      name: "Dámský střih",
      description: "Mytí, střih a foukaná.",
      durationMinutes: 60,
      priceCzk: 690,
      locationType: "in_person",
      locationDetail: "Salon Krásy, Národní 25, Praha 1",
      bufferAfterMin: 15,
    },
  });
  const barveni = await prisma.service.create({
    data: {
      name: "Barvení vlasů",
      description: "Profesionální barvení včetně mytí a foukané.",
      durationMinutes: 120,
      priceCzk: 1490,
      locationType: "in_person",
      locationDetail: "Salon Krásy, Národní 25, Praha 1",
      bufferAfterMin: 15,
    },
  });
  const pansky = await prisma.service.create({
    data: {
      name: "Pánský střih",
      description: "Klasický nebo moderní pánský střih.",
      durationMinutes: 45,
      priceCzk: 450,
      locationType: "in_person",
      locationDetail: "Salon Krásy, Národní 25, Praha 1",
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
    await createWorkingHours(p.id, [1, 2, 3, 4, 5], 9, 17);
  }
  return { providers: [anna, petr] };
}

async function seedRealitka() {
  const jana = await prisma.provider.create({
    data: {
      name: "Jana Realitní",
      email: "jana@remax.cz",
      phone: "+420777111222",
      bio: "Realitní makléřka, specializace na Prahu 6 a okolí.",
    },
  });
  const tomas = await prisma.provider.create({
    data: {
      name: "Tomáš Investiční",
      email: "tomas@remax.cz",
      phone: "+420777333444",
      bio: "Investiční nemovitosti, komerční prostory.",
    },
  });

  const prohlidka = await prisma.service.create({
    data: {
      name: "Prohlídka nemovitosti",
      description: "Osobní prohlídka konkrétní nabídky.",
      durationMinutes: 45,
      priceCzk: 0,
      showPrice: false,
      locationType: "custom",
      locationDetail: "Adresa nemovitosti vám bude zaslána emailem po rezervaci.",
      bufferBeforeMin: 30,
      bufferAfterMin: 30,
    },
  });
  const konzultace = await prisma.service.create({
    data: {
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
    await createWorkingHours(p.id, [1, 2, 3, 4, 5], 9, 18);
    await createWorkingHours(p.id, [6], 10, 14);
  }
  return { providers: [jana, tomas] };
}

async function seedKonzultant() {
  const martin = await prisma.provider.create({
    data: {
      name: "Martin Konzultant",
      email: "martin@example.com",
      phone: "+420777111222",
      bio: "Business konzultant, mentor pro startupy a freelancery.",
    },
  });

  const intro = await prisma.service.create({
    data: {
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

  await createWorkingHours(martin.id, [1, 2, 3, 4, 5], 10, 18);
  return { providers: [martin] };
}

async function main() {
  await wipe();

  let providers: Array<{ id: string; name: string; email: string | null }> = [];
  if (PRESET === "realitka") {
    console.log("📋 Šablona: realitní makléř");
    ({ providers } = await seedRealitka());
  } else if (PRESET === "konzultant") {
    console.log("📋 Šablona: konzultant");
    ({ providers } = await seedKonzultant());
  } else {
    console.log("📋 Šablona: kadeřnický salon (výchozí)");
    ({ providers } = await seedSalon());
  }

  const passwordHash = await bcrypt.hash("heslo123", 10);
  await prisma.user.create({
    data: {
      email: "admin@example.com",
      passwordHash,
      name: "Administrátor",
      role: "admin",
    },
  });
  for (const p of providers) {
    if (!p.email) continue;
    await prisma.user.create({
      data: {
        email: p.email.toLowerCase(),
        passwordHash,
        name: p.name,
        role: "provider",
        providerId: p.id,
      },
    });
  }

  console.log("✅ Seed hotovo.");
  console.log("Přihlášení do /admin (heslo: heslo123):");
  console.log("  admin@example.com");
  for (const p of providers) {
    if (p.email) console.log(`  ${p.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

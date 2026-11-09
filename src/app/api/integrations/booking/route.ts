import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PUBLIC_BASE_URL } from "@/lib/base-url";
import {
  INTEGRATION_SOURCE,
  readIntegrationBody,
  requireIntegrationSecret,
  resolveIntegrationTenant,
} from "@/lib/integration";
import { manageUrlFor, sendListingBookingConfirmation } from "@/lib/booking-actions";

/**
 * Rezervace „zvenku" (Tabidoo přes Make). Chová se jako veřejná rezervace listingu:
 * stejný potvrzovací e-mail (s odkazem Přeplánovat/zrušit), navazující pravidla
 * podle druhu listingu (cron), historie v NotificationLog, vidět v dashboardu.
 * NEvytváří Google událost (zakládá ji Make) a NEposílá e-mail vlastníkovi.
 * Idempotentní podle externalRef. Viz README „Integrace s Tabidoo".
 */
const schema = z.object({
  externalRef: z.string().trim().min(1).max(200),
  kind: z.enum(["consultation", "property"]),
  tenantSlug: z.string().optional(),
  listingSlug: z.string().optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  client: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email(),
    phone: z.string().max(40).optional(),
  }),
  note: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  sendConfirmation: z.boolean().default(true),
});

function urlsFor(b: { id: string; confirmationToken: string | null }) {
  return {
    manageUrl: manageUrlFor(b.confirmationToken),
    dashboardUrl: `${PUBLIC_BASE_URL}/dashboard/bookings/${b.id}`,
  };
}

export async function POST(req: NextRequest) {
  const denied = requireIntegrationSecret(req);
  if (denied) return denied;

  const body = await readIntegrationBody(req);
  if (body === undefined) {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Idempotence — stejný externalRef už existuje → nic nezakládat ani neposílat.
  const existing = await prisma.booking.findUnique({
    where: { externalRef: data.externalRef },
  });
  if (existing) {
    return NextResponse.json({
      bookingId: existing.id,
      ...urlsFor(existing),
      emailSent: false,
      alreadyExisted: true,
    });
  }

  const tenant = await resolveIntegrationTenant(data.tenantSlug);
  if (!tenant) {
    return NextResponse.json(
      { error: "Nelze určit účet (tenantSlug / INTEGRATION_TENANT_SLUG)" },
      { status: 400 },
    );
  }

  const listing = await prisma.eventListing.findFirst({
    where: data.listingSlug
      ? { tenantId: tenant.id, slug: data.listingSlug, kind: data.kind }
      : { tenantId: tenant.id, kind: data.kind, active: true },
    orderBy: { createdAt: "asc" },
    include: { provider: true },
  });
  if (!listing) {
    return NextResponse.json(
      {
        error: data.listingSlug
          ? `Položka „${data.listingSlug}" druhu ${data.kind} nenalezena`
          : `Žádná aktivní položka druhu ${data.kind}`,
      },
      { status: 404 },
    );
  }

  const startsAt = new Date(data.startsAt);
  const endsAt = data.endsAt
    ? new Date(data.endsAt)
    : new Date(startsAt.getTime() + listing.durationMinutes * 60_000);
  if (startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Termín je v minulosti" }, { status: 400 });
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return NextResponse.json({ error: "endsAt musí být po startsAt" }, { status: 400 });
  }

  // Provider + Service stejně jako u veřejné rezervace listingu.
  let providerId = listing.providerId;
  if (!providerId) {
    const p = await prisma.provider.findFirst({
      where: { tenantId: tenant.id, active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!p) {
      return NextResponse.json({ error: "V účtu není žádná osoba (provider)." }, { status: 500 });
    }
    providerId = p.id;
  }
  let service = listing.serviceId
    ? await prisma.service.findUnique({ where: { id: listing.serviceId } })
    : null;
  if (!service) {
    service =
      (await prisma.service.findFirst({
        where: { tenantId: tenant.id, name: "Prohlídka" },
      })) ??
      (await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: "Prohlídka",
          description: "Prohlídka nemovitosti",
          durationMinutes: listing.durationMinutes,
          priceCzk: 0,
          showPrice: false,
          locationType: "custom",
          locationDetail: listing.address,
          active: true,
        },
      }));
  }

  const clientEmail = data.client.email.toLowerCase().trim();
  const clientPhone = (data.client.phone ?? "").replace(/\s+/g, "");
  const clientRecord = await prisma.client.upsert({
    where: {
      tenantId_email_phone: { tenantId: tenant.id, email: clientEmail, phone: clientPhone },
    },
    update: { name: data.client.name },
    create: {
      tenantId: tenant.id,
      name: data.client.name,
      email: clientEmail,
      phone: clientPhone,
    },
  });

  let booking;
  try {
    booking = await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        clientId: clientRecord.id,
        serviceId: service.id,
        providerId,
        listingId: listing.id,
        startsAt,
        endsAt,
        note: data.note || null,
        location: data.location || null,
        customAnswers: [],
        confirmationToken: randomBytes(16).toString("hex"),
        externalRef: data.externalRef,
        source: INTEGRATION_SOURCE,
      },
    });
  } catch (e) {
    // Souběžné volání se stejným externalRef → vrátit to první.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const dup = await prisma.booking.findUnique({
        where: { externalRef: data.externalRef },
      });
      if (dup) {
        return NextResponse.json({
          bookingId: dup.id,
          ...urlsFor(dup),
          emailSent: false,
          alreadyExisted: true,
        });
      }
    }
    throw e;
  }

  let emailSent = false;
  if (data.sendConfirmation) {
    const r = await sendListingBookingConfirmation({
      booking,
      listing,
      tenant,
      client: clientRecord,
    });
    emailSent = r.ok;
  }

  return NextResponse.json({
    bookingId: booking.id,
    ...urlsFor(booking),
    emailSent,
    alreadyExisted: false,
  });
}

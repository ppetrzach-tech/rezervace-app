import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getTenantBySlug } from "@/lib/tenant";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { generateIcs } from "@/lib/ics";
import { createCalendarEvent, isCalendarConfigured } from "@/lib/google-calendar";
import { sendOwnerNewBookingEmail } from "@/lib/owner-notify";

const schema = z.object({
  tenantSlug: z.string(),
  slotId: z.string(),
  client: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().min(6).max(40),
    note: z.string().max(500).optional(),
  }),
  answers: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        value: z.string(),
      }),
    )
    .default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  const { tenantSlug, slotId, client, answers } = parsed.data;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant nenalezen" }, { status: 404 });

  const listing = await prisma.eventListing.findFirst({
    where: { id: params.id, tenantId: tenant.id, active: true },
    include: { provider: true },
  });
  if (!listing) return NextResponse.json({ error: "Nemovitost nenalezena" }, { status: 404 });

  const slot = await prisma.eventSlot.findFirst({
    where: { id: slotId, listingId: listing.id },
    include: { booking: true },
  });
  if (!slot) return NextResponse.json({ error: "Slot nenalezen" }, { status: 404 });
  if (slot.booking) {
    return NextResponse.json(
      { error: "Tento termín už byl mezitím rezervován." },
      { status: 409 },
    );
  }
  if (slot.startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Termín je v minulosti" }, { status: 400 });
  }

  // Potřebujeme nějaký provider — buď přiřazený z listingu, nebo musíme někoho vyrobit/použít.
  // Pokud listing nemá providera, najdeme prvního aktivního v tenantovi.
  let providerId = listing.providerId;
  if (!providerId) {
    const p = await prisma.provider.findFirst({
      where: { tenantId: tenant.id, active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!p) {
      return NextResponse.json(
        { error: "V účtu není nakonfigurován žádný realitní makléř." },
        { status: 500 },
      );
    }
    providerId = p.id;
  }

  // Také potřebujeme `service` (kvůli vazbě v Booking modelu). Najdeme nebo vytvoříme generic.
  let service = listing.serviceId
    ? await prisma.service.findUnique({ where: { id: listing.serviceId } })
    : null;
  if (!service) {
    // najít „Prohlídka" nebo vytvořit
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

  const clientEmail = client.email.toLowerCase().trim();
  const clientPhone = client.phone.replace(/\s+/g, "");

  const clientRecord = await prisma.client.upsert({
    where: {
      tenantId_email_phone: {
        tenantId: tenant.id,
        email: clientEmail,
        phone: clientPhone,
      },
    },
    update: { name: client.name },
    create: {
      tenantId: tenant.id,
      name: client.name,
      email: clientEmail,
      phone: clientPhone,
    },
  });

  const confirmationToken = randomBytes(16).toString("hex");

  const booking = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      clientId: clientRecord.id,
      serviceId: service.id,
      providerId,
      listingId: listing.id,
      eventSlotId: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      note: client.note || null,
      customAnswers: answers,
      confirmationToken,
    },
  });

  const ics = generateIcs({
    uid: `booking-${booking.id}@rezervace`,
    title: `${listing.title}${tenant.name ? ` — ${tenant.name}` : ""}`,
    description: listing.description ?? undefined,
    location: listing.address ?? undefined,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    organizerName: tenant.name,
    organizerEmail: listing.provider?.email ?? undefined,
  });

  const emailRes = await sendBookingConfirmationEmail({
    clientName: clientRecord.name,
    clientEmail: clientRecord.email,
    serviceName: listing.title,
    providerName: listing.provider?.name ?? tenant.name,
    startsAt: slot.startsAt,
    durationMinutes: listing.durationMinutes,
    priceCzk: 0,
    showPrice: false,
    locationType: "custom",
    locationDetail: listing.address,
    note: booking.note,
    bookingId: booking.id,
    businessName: tenant.name,
    replyTo: tenant.replyToEmail || tenant.ownerEmail || undefined,
    ics,
  });

  // Google Calendar — vytvoříme událost ve vlastníkově kalendáři (pokud je nastavený).
  let googleEventLink: string | null = null;
  if (tenant.googleCalendarId && isCalendarConfigured()) {
    const answersText = (answers ?? [])
      .filter((a) => a.value)
      .map((a) => `${a.label}: ${a.value}`)
      .join("\n");
    const desc = [
      listing.description,
      "",
      `Klient: ${clientRecord.name}`,
      `Email: ${clientRecord.email}`,
      `Telefon: ${clientRecord.phone}`,
      booking.note ? `Poznámka: ${booking.note}` : "",
      answersText ? `\n${answersText}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const gcalRes = await createCalendarEvent({
      calendarId: tenant.googleCalendarId,
      timezone: tenant.googleTimezone,
      summary: `🏠 ${listing.title} — ${clientRecord.name}`,
      description: desc,
      location: listing.address ?? undefined,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      attendees: [
        {
          email: clientRecord.email,
          displayName: clientRecord.name,
        },
      ],
    });
    if (gcalRes.ok) {
      googleEventLink = gcalRes.htmlLink ?? null;
      await prisma.booking.update({
        where: { id: booking.id },
        data: { googleEventId: gcalRes.eventId },
      });
    } else {
      console.warn("[book] Google Calendar event create failed:", gcalRes.error);
    }
  }

  // Email vlastníkovi (makléři)
  let ownerEmailSent = false;
  if (tenant.ownerEmail) {
    const baseUrl = process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app";
    const ownerRes = await sendOwnerNewBookingEmail({
      ownerEmail: tenant.ownerEmail,
      businessName: tenant.name,
      serviceName: listing.title,
      providerName: listing.provider?.name ?? tenant.name,
      clientName: clientRecord.name,
      clientEmail: clientRecord.email,
      clientPhone: clientRecord.phone,
      clientNote: booking.note,
      startsAt: slot.startsAt,
      durationMinutes: listing.durationMinutes,
      location: listing.address,
      bookingId: booking.id,
      publicBookingsUrl: `${baseUrl}/dashboard/bookings`,
      customAnswers: answers,
      googleEventLink,
      ics,
    });
    ownerEmailSent = ownerRes.ok;
  }

  return NextResponse.json({
    bookingId: booking.id,
    emailSent: emailRes.ok,
    ownerEmailSent,
    googleSynced: !!googleEventLink,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import { isSlotStillFree } from "@/lib/slots";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationSms } from "@/lib/sms";
import { getTenantBySlug } from "@/lib/tenant";
import { generateIcs } from "@/lib/ics";
import { createCalendarEvent, isCalendarConfigured } from "@/lib/google-calendar";
import { sendOwnerNewBookingEmail } from "@/lib/owner-notify";
import { locationLabel } from "@/lib/branding";

const bodySchema = z.object({
  tenantSlug: z.string().min(1),
  serviceId: z.string().min(1),
  providerId: z.string().min(1),
  startsAt: z.string().datetime(),
  client: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().min(6).max(30),
    note: z.string().max(500).optional(),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tenantSlug, serviceId, providerId, startsAt, client } = parsed.data;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant nenalezen" }, { status: 404 });

  const service = await prisma.service.findFirst({
    where: { id: serviceId, tenantId: tenant.id, active: true },
  });
  if (!service) {
    return NextResponse.json({ error: "Služba není dostupná" }, { status: 404 });
  }

  const provider = await prisma.provider.findFirst({
    where: { id: providerId, tenantId: tenant.id, active: true },
  });
  if (!provider) {
    return NextResponse.json({ error: "Osoba není dostupná" }, { status: 404 });
  }

  const link = await prisma.serviceProvider.findUnique({
    where: { serviceId_providerId: { serviceId, providerId } },
  });
  if (!link) {
    return NextResponse.json(
      { error: "Tato osoba tuto službu nenabízí" },
      { status: 400 },
    );
  }

  const startsAtDate = new Date(startsAt);
  const endsAtDate = addMinutes(startsAtDate, service.durationMinutes);

  if (startsAtDate.getTime() < Date.now()) {
    return NextResponse.json({ error: "Termín už je v minulosti" }, { status: 400 });
  }

  const free = await isSlotStillFree(providerId, startsAtDate, endsAtDate);
  if (!free) {
    return NextResponse.json(
      { error: "Vybraný termín už není volný. Vyberte prosím jiný." },
      { status: 409 },
    );
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

  const booking = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      clientId: clientRecord.id,
      serviceId,
      providerId,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      note: client.note || null,
    },
  });

  const ics = generateIcs({
    uid: `booking-${booking.id}@rezervace`,
    title: `${service.name} — ${tenant.name}`,
    description: service.description ?? undefined,
    location: service.locationDetail ?? undefined,
    startsAt: startsAtDate,
    endsAt: endsAtDate,
    organizerName: tenant.name,
    organizerEmail: provider.email ?? undefined,
  });

  const emailRes = await sendBookingConfirmationEmail({
    clientName: clientRecord.name,
    clientEmail: clientRecord.email,
    serviceName: service.name,
    providerName: provider.name,
    startsAt: startsAtDate,
    durationMinutes: service.durationMinutes,
    priceCzk: service.priceCzk,
    showPrice: service.showPrice,
    locationType: service.locationType,
    locationDetail: service.locationDetail,
    note: booking.note,
    bookingId: booking.id,
    businessName: tenant.name,
    replyTo: tenant.replyToEmail || tenant.ownerEmail || undefined,
    ics,
  });

  const smsRes = await sendBookingConfirmationSms({
    clientName: clientRecord.name,
    clientPhone: clientRecord.phone,
    serviceName: service.name,
    providerName: provider.name,
    startsAt: startsAtDate,
  });

  // Zalogovat potvrzovací email + SMS do historie notifikací
  await prisma.notificationLog.createMany({
    data: [
      {
        bookingId: booking.id,
        ruleId: null,
        channel: "email",
        status: emailRes.ok ? "sent" : "failed",
        error: emailRes.error ?? null,
      },
    ],
  }).catch(() => {});

  // Google Calendar — vytvoříme událost u vlastníka
  let googleEventLink: string | null = null;
  if (tenant.googleCalendarId && isCalendarConfigured()) {
    const desc = [
      service.description,
      "",
      `Klient: ${clientRecord.name}`,
      `Email: ${clientRecord.email}`,
      `Telefon: ${clientRecord.phone}`,
      booking.note ? `Poznámka: ${booking.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const gcalRes = await createCalendarEvent({
      calendarId: tenant.googleCalendarId,
      timezone: tenant.googleTimezone,
      summary: `${service.name} — ${clientRecord.name}`,
      description: desc,
      location: service.locationDetail ?? undefined,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      attendees: [
        { email: clientRecord.email, displayName: clientRecord.name },
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

  // Email vlastníkovi
  let ownerEmailSent = false;
  if (tenant.ownerEmail) {
    const baseUrl = process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app";
    const ownerRes = await sendOwnerNewBookingEmail({
      ownerEmail: tenant.ownerEmail,
      businessName: tenant.name,
      serviceName: service.name,
      providerName: provider.name,
      clientName: clientRecord.name,
      clientEmail: clientRecord.email,
      clientPhone: clientRecord.phone,
      clientNote: booking.note,
      startsAt: startsAtDate,
      durationMinutes: service.durationMinutes,
      location: service.locationDetail ?? locationLabel(service.locationType),
      bookingId: booking.id,
      publicBookingsUrl: `${baseUrl}/dashboard/bookings`,
      googleEventLink,
      ics,
    });
    ownerEmailSent = ownerRes.ok;
  }

  return NextResponse.json({
    bookingId: booking.id,
    emailSent: emailRes.ok,
    smsSent: smsRes.ok,
    ownerEmailSent,
    googleSynced: !!googleEventLink,
  });
}

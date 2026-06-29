import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { calendarButtonsHtml } from "@/lib/calendar-links";
import { PUBLIC_BASE_URL } from "@/lib/base-url";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  isCalendarConfigured,
} from "@/lib/google-calendar";
import { sendOwnerNewBookingEmail } from "@/lib/owner-notify";

const schema = z.object({ slotId: z.string().min(1) });

/**
 * Přeplánování klientem na nový termín — BEZ opětovného vyplňování formuláře.
 * Z původní rezervace (token) převezme jméno, e-mail, telefon i odpovědi.
 * Vytvoří NOVOU rezervaci na zvolený slot. Stávající tok rezervací nemění.
 *
 * POST /api/booking-reschedule/[token]  body: { slotId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Chybí termín" }, { status: 400 });
  }

  const original = await prisma.booking.findUnique({
    where: { confirmationToken: params.token },
    include: { client: true, listing: true, service: true, tenant: true },
  });
  if (!original || !original.listing) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }

  const slot = await prisma.eventSlot.findFirst({
    where: { id: parsed.data.slotId, listingId: original.listing.id },
    include: { booking: true },
  });
  if (!slot) {
    return NextResponse.json({ error: "Termín nenalezen" }, { status: 404 });
  }
  if (slot.booking || slot.startsAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Tento termín už není volný. Vyberte prosím jiný." },
      { status: 409 },
    );
  }

  const tenant = original.tenant;
  const listing = original.listing;
  const confirmationToken = randomBytes(16).toString("hex");

  const createData: Prisma.BookingUncheckedCreateInput = {
    tenantId: tenant.id,
    clientId: original.clientId,
    serviceId: original.serviceId,
    providerId: original.providerId,
    listingId: listing.id,
    eventSlotId: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    note: original.note,
    confirmationToken,
  };
  if (original.customAnswers != null) {
    createData.customAnswers = original.customAnswers as Prisma.InputJsonValue;
  }

  let booking;
  try {
    booking = await prisma.booking.create({ data: createData });
  } catch {
    // typicky kolize na obsazeném slotu (unikátní eventSlotId)
    return NextResponse.json(
      { error: "Tento termín už není volný. Vyberte prosím jiný." },
      { status: 409 },
    );
  }

  // Pojistka: kdyby původní rezervace ještě nebyla zrušená, ukliď ji
  // (uvolni slot + smaž kalendář), ať nevzniknou dvě aktivní.
  if (original.status !== "cancelled") {
    await prisma.booking
      .update({
        where: { id: original.id },
        data: {
          status: "cancelled",
          eventSlotId: null,
          clientResponse: "reschedule",
          emailingStopped: true,
        },
      })
      .catch(() => {});
    if (original.googleEventId && tenant.googleCalendarId) {
      await deleteCalendarEvent(tenant.googleCalendarId, original.googleEventId).catch(
        () => {},
      );
    }
  }

  // Potvrzovací e-mail klientovi (s tlačítky do kalendáře)
  const appBaseUrl = PUBLIC_BASE_URL;
  const calendarHtml = calendarButtonsHtml({
    title: `${listing.title}${tenant.name ? ` — ${tenant.name}` : ""}`,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    location: listing.address ?? undefined,
    icsUrl: `${appBaseUrl}/api/booking-ics/${confirmationToken}`,
  });

  const emailRes = await sendBookingConfirmationEmail({
    clientName: original.client.name,
    clientEmail: original.client.email,
    serviceName: listing.title,
    providerName: tenant.name,
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
    calendarHtml,
  }).catch(() => ({ ok: false, error: "send failed" }) as const);

  await prisma.notificationLog
    .create({
      data: {
        bookingId: booking.id,
        ruleId: null,
        channel: "email",
        label: "✅ Potvrzení rezervace (přeplánováno)",
        status: emailRes.ok ? "sent" : "failed",
        error: emailRes.ok ? null : (emailRes.error ?? null),
      },
    })
    .catch(() => {});

  // Google Calendar — nová událost (bez účastníků kvůli service accountu)
  let googleEventLink: string | null = null;
  if (tenant.googleCalendarId && isCalendarConfigured()) {
    const answers = Array.isArray(original.customAnswers)
      ? (original.customAnswers as unknown as Array<{ label: string; value: string }>)
      : [];
    const answersText = answers
      .filter((a) => a && a.value)
      .map((a) => `${a.label}: ${a.value}`)
      .join("\n");
    const desc = [
      listing.description,
      "",
      `Klient: ${original.client.name}`,
      `Email: ${original.client.email}`,
      `Telefon: ${original.client.phone}`,
      booking.note ? `Poznámka: ${booking.note}` : "",
      answersText ? `\n${answersText}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const gcal = await createCalendarEvent({
      calendarId: tenant.googleCalendarId,
      timezone: tenant.googleTimezone,
      summary: `🏠 ${listing.title} — ${original.client.name}`,
      description: desc,
      location: listing.address ?? undefined,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
    if (gcal.ok) {
      googleEventLink = gcal.htmlLink ?? null;
      await prisma.booking
        .update({ where: { id: booking.id }, data: { googleEventId: gcal.eventId } })
        .catch(() => {});
    }
  }

  // Upozornění vlastníkovi
  if (tenant.ownerEmail) {
    const answers = Array.isArray(original.customAnswers)
      ? (original.customAnswers as unknown as Array<{ label: string; value: string }>)
      : [];
    await sendOwnerNewBookingEmail({
      ownerEmail: tenant.ownerEmail,
      businessName: tenant.name,
      serviceName: listing.title,
      providerName: tenant.name,
      clientName: original.client.name,
      clientEmail: original.client.email,
      clientPhone: original.client.phone,
      clientNote: booking.note,
      startsAt: slot.startsAt,
      durationMinutes: listing.durationMinutes,
      location: listing.address,
      bookingId: booking.id,
      publicBookingsUrl: `${appBaseUrl}/dashboard/bookings`,
      customAnswers: answers,
      googleEventLink,
      calendarHtml,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, bookingId: booking.id });
}

/**
 * Sdílené akce nad rezervací — JEDINÉ místo, kde se posílá potvrzení,
 * přesouvá termín a ruší rezervace. Používají je:
 *  • veřejná rezervace listingu   (api/properties/[id]/book)
 *  • dashboard přesun / zrušení   (api/bookings/[id]/move|cancel)
 *  • integrace (Tabidoo přes Make) (api/integrations/booking/…)
 * Díky tomu se chování (texty e-mailů, NotificationLog, kalendář) nerozejde.
 */
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sendBookingConfirmationEmail, escapeHtml } from "./email";
import { sendEmail, type SendEmailResult } from "./email-provider";
import { calendarButtonsHtml } from "./calendar-links";
import { markdownishToHtml } from "./email-format";
import { formalGreeting } from "./czech-name";
import { czDateTimeLong } from "./datetime";
import { PUBLIC_BASE_URL } from "./base-url";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  isCalendarConfigured,
} from "./google-calendar";
import { sendBookingChangeEmailToClient } from "./booking-client-email";

export const BOOKING_FULL_INCLUDE = {
  client: true,
  service: true,
  provider: true,
  listing: true,
  tenant: true,
} satisfies Prisma.BookingInclude;

export type FullBooking = Prisma.BookingGetPayload<{
  include: typeof BOOKING_FULL_INCLUDE;
}>;

export function manageUrlFor(confirmationToken: string | null): string {
  return confirmationToken
    ? `${PUBLIC_BASE_URL}/booking/manage/${confirmationToken}`
    : "";
}

/**
 * Potvrzovací e-mail klientovi po rezervaci listingu (prohlídka / konzultace)
 * vč. tlačítek do kalendáře a odkazu „Přeplánovat nebo zrušit".
 * Zapíše se do NotificationLog jako „✅ Potvrzení rezervace".
 */
export async function sendListingBookingConfirmation(args: {
  booking: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    note: string | null;
    confirmationToken: string | null;
    location?: string | null;
  };
  listing: {
    title: string;
    emailName: string | null;
    address: string | null;
    durationMinutes: number;
    provider?: { name: string } | null;
  };
  tenant: {
    name: string;
    replyToEmail: string | null;
    ownerEmail: string | null;
  };
  client: { name: string; email: string };
}): Promise<{ ok: boolean; error?: string; calendarHtml: string }> {
  const { booking, listing, tenant, client } = args;
  const location = booking.location || listing.address;
  const calendarHtml = calendarButtonsHtml({
    title: `${listing.title}${tenant.name ? ` — ${tenant.name}` : ""}`,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    location: location ?? undefined,
    icsUrl: booking.confirmationToken
      ? `${PUBLIC_BASE_URL}/api/booking-ics/${booking.confirmationToken}`
      : undefined,
  });

  const durationMinutes = Math.max(
    1,
    Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000),
  );

  const emailRes = await sendBookingConfirmationEmail({
    clientName: client.name,
    clientEmail: client.email,
    serviceName: listing.emailName || listing.title,
    providerName: listing.provider?.name ?? tenant.name,
    startsAt: booking.startsAt,
    durationMinutes,
    priceCzk: 0,
    showPrice: false,
    locationType: "custom",
    locationDetail: location,
    note: booking.note,
    bookingId: booking.id,
    businessName: tenant.name,
    replyTo: tenant.replyToEmail || tenant.ownerEmail || undefined,
    calendarHtml,
    manageUrl: manageUrlFor(booking.confirmationToken) || undefined,
  }).catch((e) => ({ ok: false, error: String(e) }) as SendEmailResult);

  await prisma.notificationLog
    .create({
      data: {
        bookingId: booking.id,
        ruleId: null,
        channel: "email",
        label: "✅ Potvrzení rezervace",
        status: emailRes.ok ? "sent" : "failed",
        error: emailRes.error ?? null,
      },
    })
    .catch(() => {});

  return { ok: emailRes.ok, error: emailRes.error, calendarHtml };
}

export class BookingConflictError extends Error {}

/**
 * Přesun rezervace na nový termín NA MÍSTĚ (stejný klient, odpovědi, historie).
 * Kalendář: smaže starou událost a vytvoří novou (jen když `syncCalendar`).
 * Klientovi pošle JEDEN e-mail o novém termínu a zapíše ho do NotificationLog.
 * Hází BookingConflictError, když je cílový slot mezitím obsazený.
 */
export async function moveBooking(args: {
  booking: FullBooking;
  startsAt: Date;
  endsAt: Date;
  /** Slot listingu (dashboard); null = volný termín mimo sloty (integrace). */
  slotId: string | null;
  syncCalendar: boolean;
  logLabel?: string;
}): Promise<{ emailSent: boolean }> {
  const { booking, startsAt, endsAt, slotId, syncCalendar } = args;
  const tenant = booking.tenant;
  const listing = booking.listing;

  try {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { eventSlotId: slotId, startsAt, endsAt },
    });
  } catch {
    throw new BookingConflictError("Tento termín už je obsazený.");
  }

  const location = booking.location || listing?.address || null;
  const title = listing?.title ?? booking.service.name;

  if (syncCalendar && tenant.googleCalendarId && isCalendarConfigured()) {
    if (booking.googleEventId) {
      await deleteCalendarEvent(tenant.googleCalendarId, booking.googleEventId).catch(
        () => {},
      );
    }
    const answers = Array.isArray(booking.customAnswers)
      ? (booking.customAnswers as unknown as Array<{ label: string; value: string }>)
      : [];
    const desc = [
      listing?.description,
      "",
      `Klient: ${booking.client.name}`,
      `Email: ${booking.client.email}`,
      `Telefon: ${booking.client.phone}`,
      booking.note ? `Poznámka: ${booking.note}` : "",
      ...answers.filter((a) => a && a.value).map((a) => `${a.label}: ${a.value}`),
    ]
      .filter(Boolean)
      .join("\n");
    const gcal = await createCalendarEvent({
      calendarId: tenant.googleCalendarId,
      timezone: tenant.googleTimezone,
      summary: `${listing?.kind === "consultation" ? "💬" : "🏠"} ${title} — ${booking.client.name}`,
      description: desc,
      location: location ?? undefined,
      startsAt,
      endsAt,
    }).catch(() => ({ ok: false as const, error: "gcal" }));
    if (gcal.ok) {
      await prisma.booking
        .update({ where: { id: booking.id }, data: { googleEventId: gcal.eventId } })
        .catch(() => {});
    }
  }

  const serviceName = listing?.emailName || title;
  const dateStr = czDateTimeLong(startsAt);
  const phone = tenant.ownerPhone || "";
  const greeting = formalGreeting(booking.client.name);
  const body = `${greeting},

Váš termín **${serviceName}** byl přeplánován. Nový termín:

📅 **${dateStr}**${location ? `\n📍 ${location}` : ""}

Pokud by Vám nový termín nevyhovoval, dejte mi prosím vědět.

Těším se na Vás,
${tenant.name}${phone ? `\nTel.: ${phone}` : ""}`;

  const logId = randomUUID();
  const emailRes = await sendEmail({
    to: booking.client.email,
    subject: `Změna termínu — ${serviceName}`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="color:#6b7280;font-size:13px;">${escapeHtml(tenant.name)}</div>
      <div style="margin-top:8px;">${markdownishToHtml(body)}</div>
      <img src="${PUBLIC_BASE_URL}/api/track/${logId}" width="1" height="1" alt="" style="display:none" />
    </div>`,
    replyTo: tenant.replyToEmail || tenant.ownerEmail || undefined,
  }).catch(() => ({ ok: false, error: "send failed" }) as const);

  await prisma.notificationLog
    .create({
      data: {
        id: logId,
        bookingId: booking.id,
        ruleId: null,
        channel: "email",
        label: args.logLabel ?? "🔄 Přeplánováno — e-mail klientovi (nový termín)",
        status: emailRes.ok ? "sent" : "failed",
        error: emailRes.ok ? null : (emailRes.error ?? null),
      },
    })
    .catch(() => {});

  return { emailSent: emailRes.ok };
}

/**
 * Zrušení rezervace (nebo výzva k přeplánování): status cancelled, uvolní slot,
 * zastaví další automatické e-maily, smaže událost v kalendáři (pokud existuje)
 * a pošle klientovi e-mail. Zapíše do NotificationLog.
 */
export async function cancelBooking(args: {
  booking: FullBooking;
  action: "cancel" | "reschedule";
  logLabelSuffix?: string;
}): Promise<{ clientEmailed: boolean }> {
  const { booking, action } = args;

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled", eventSlotId: null, emailingStopped: true },
  });

  if (booking.googleEventId && booking.tenant.googleCalendarId) {
    const res = await deleteCalendarEvent(
      booking.tenant.googleCalendarId,
      booking.googleEventId,
    ).catch((e) => ({ ok: false, error: String(e) }));
    if (!res.ok) console.warn("[cancel] Google Calendar delete failed:", res.error);
  }

  let clientEmailed = false;
  try {
    const logId = randomUUID();
    const r = await sendBookingChangeEmailToClient(booking, action, logId);
    clientEmailed = r.ok;
    const base =
      action === "reschedule"
        ? "🔄 Přeplánování — e-mail klientovi"
        : "❌ Zrušení — e-mail klientovi";
    await prisma.notificationLog
      .create({
        data: {
          id: logId,
          bookingId: booking.id,
          ruleId: null,
          channel: "email",
          label: args.logLabelSuffix ? `${base} ${args.logLabelSuffix}` : base,
          status: r.ok ? "sent" : "failed",
          error: r.error ?? null,
        },
      })
      .catch(() => {});
  } catch (e) {
    console.warn("[cancel] client email failed:", e);
  }

  return { clientEmailed };
}

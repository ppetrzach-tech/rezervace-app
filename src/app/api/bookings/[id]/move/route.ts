import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";
import { sendEmail } from "@/lib/email-provider";
import { escapeHtml } from "@/lib/email";
import { markdownishToHtml } from "@/lib/email-format";
import { formalGreeting } from "@/lib/czech-name";
import { czDateTimeLong } from "@/lib/datetime";
import { PUBLIC_BASE_URL } from "@/lib/base-url";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  isCalendarConfigured,
} from "@/lib/google-calendar";

const schema = z.object({ slotId: z.string().min(1) });

/**
 * Přeplánování vlastníkem/asistentem — PŘESUN rezervace na jiný termín na místě.
 * Zachová klienta, otázky i odpovědi; uvolní starý slot; přesune událost
 * v kalendáři; pošle klientovi JEDEN e-mail o novém termínu. Žádný duplikát.
 *
 * POST /api/bookings/[id]/move  body: { slotId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

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

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
    include: { client: true, listing: true, tenant: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }
  if (!canManage(session.user) && booking.providerId !== session.user.providerId) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "Zrušenou rezervaci nelze přeplánovat." },
      { status: 400 },
    );
  }
  if (!booking.listing) {
    return NextResponse.json(
      { error: "Rezervace nemá nemovitost." },
      { status: 400 },
    );
  }

  const slot = await prisma.eventSlot.findFirst({
    where: { id: parsed.data.slotId, listingId: booking.listing.id },
    include: { booking: true },
  });
  if (!slot) {
    return NextResponse.json({ error: "Termín nenalezen" }, { status: 404 });
  }
  if (slot.booking && slot.booking.id !== booking.id) {
    return NextResponse.json(
      { error: "Tento termín už je obsazený." },
      { status: 409 },
    );
  }
  if (slot.startsAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Termín už proběhl — vyberte budoucí." },
      { status: 400 },
    );
  }

  // PŘESUN na místě — mění se jen slot + časy; otázky/odpovědi zůstávají.
  try {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        eventSlotId: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Tento termín už je obsazený." },
      { status: 409 },
    );
  }

  const tenant = booking.tenant;
  const listing = booking.listing;

  // Kalendář — přesun (smaž starou událost, vytvoř novou v novém čase)
  if (tenant.googleCalendarId && isCalendarConfigured()) {
    if (booking.googleEventId) {
      await deleteCalendarEvent(
        tenant.googleCalendarId,
        booking.googleEventId,
      ).catch(() => {});
    }
    const answers = Array.isArray(booking.customAnswers)
      ? (booking.customAnswers as unknown as Array<{ label: string; value: string }>)
      : [];
    const desc = [
      listing.description,
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
      summary: `${listing.kind === "consultation" ? "💬" : "🏠"} ${listing.title} — ${booking.client.name}`,
      description: desc,
      location: listing.address ?? undefined,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    }).catch(() => ({ ok: false as const, error: "gcal" }));
    if (gcal.ok) {
      await prisma.booking
        .update({ where: { id: booking.id }, data: { googleEventId: gcal.eventId } })
        .catch(() => {});
    }
  }

  // Jeden e-mail klientovi o novém termínu
  const serviceName = listing.emailName || listing.title;
  const dateStr = czDateTimeLong(slot.startsAt);
  const phone = booking.tenant.ownerPhone || "";
  const providerName = tenant.name;
  const greeting = formalGreeting(booking.client.name);
  const body2 = `${greeting},

Váš termín **${serviceName}** byl přeplánován. Nový termín:

📅 **${dateStr}**${listing.address ? `\n📍 ${listing.address}` : ""}

Pokud by Vám nový termín nevyhovoval, dejte mi prosím vědět.

Těším se na Vás,
${providerName}${phone ? `\nTel.: ${phone}` : ""}`;

  const logId = randomUUID();
  const emailRes = await sendEmail({
    to: booking.client.email,
    subject: `Změna termínu — ${serviceName}`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="color:#6b7280;font-size:13px;">${escapeHtml(tenant.name)}</div>
      <div style="margin-top:8px;">${markdownishToHtml(body2)}</div>
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
        label: "🔄 Přeplánováno — e-mail klientovi (nový termín)",
        status: emailRes.ok ? "sent" : "failed",
        error: emailRes.ok ? null : (emailRes.error ?? null),
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}

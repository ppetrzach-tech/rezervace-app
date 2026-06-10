import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email-provider";
import { escapeHtml } from "@/lib/email";
import { markdownishToHtml } from "@/lib/email-format";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { formalGreeting, gendered } from "@/lib/czech-name";
import { czDateTimeLong } from "@/lib/datetime";
import { PUBLIC_BASE_URL } from "@/lib/base-url";

const schema = z.object({
  action: z.enum(["reschedule", "cancel", "decline"]),
  reason: z.string().trim().min(1).max(1000),
});

/**
 * Klient spravuje svou rezervaci přes token z emailu:
 *  - reschedule = chci přeplánovat (zruší termín, uvolní slot, pošle odkaz na nový)
 *  - cancel     = zruším termín bez náhrady
 *  - decline    = nemám zájem o nemovitost (zastaví další emaily)
 *
 * POST /api/booking-manage/[token]
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
    const tooShort = parsed.error.issues.some((i) => i.path[0] === "reason");
    return NextResponse.json(
      { error: tooShort ? "Uveďte prosím důvod." : "Neplatná akce" },
      { status: 400 },
    );
  }
  const action = parsed.data.action;
  const reason = parsed.data.reason.trim();

  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: params.token },
    include: {
      client: true,
      service: true,
      provider: true,
      listing: true,
      tenant: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }

  const baseUrl = PUBLIC_BASE_URL;
  const isFuture = booking.startsAt.getTime() > Date.now();
  const propertyUrl = booking.listing
    ? `${baseUrl}/${booking.tenant.slug}/p/${booking.listing.slug}`
    : `${baseUrl}/${booking.tenant.slug}`;

  // === Aktualizace rezervace podle akce ===
  const willCancel = action === "reschedule" || action === "cancel" || (action === "decline" && isFuture);

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      clientResponse: action,
      clientResponseAt: new Date(),
      clientResponseReason: reason,
      emailingStopped: true, // další automatické emaily se nepošlou
      ...(willCancel
        ? { status: "cancelled", eventSlotId: null } // uvolní slot pro další zájemce
        : {}),
    },
  });

  // Smazat událost v Google Calendar (pokud existuje a rušíme)
  if (willCancel && booking.googleEventId && booking.tenant.googleCalendarId) {
    await deleteCalendarEvent(booking.tenant.googleCalendarId, booking.googleEventId).catch(
      () => {},
    );
  }

  const serviceName = booking.listing?.title || booking.service.name;
  const dateStr = czDateTimeLong(booking.startsAt);
  const greeting = formalGreeting(booking.client.name);
  const chtel = gendered(booking.client.name, "chtěl", "chtěla");
  const vitan = gendered(booking.client.name, "vítán", "vítána");
  const potreboval = gendered(booking.client.name, "potřeboval", "potřebovala");
  const phone = booking.provider.phone || booking.tenant.ownerPhone || "";
  const replyTo = booking.tenant.replyToEmail || booking.tenant.ownerEmail || undefined;

  // === Email klientovi ===
  let clientBody = "";
  let clientSubject = "";
  if (action === "reschedule") {
    clientSubject = `Přeplánování termínu — ${serviceName}`;
    clientBody = `${greeting},

Váš termín **${serviceName}** (${dateStr}) byl zrušen.

Nový termín si snadno vyberte zde:
[📅 Vybrat nový termín](${propertyUrl})

Kdyby cokoliv, ozvěte se mi.

Přeji hezký den,
${booking.provider.name}${phone ? `\nTel.: ${phone}` : ""}`;
  } else if (action === "cancel") {
    clientSubject = `Zrušení termínu — ${serviceName}`;
    clientBody = `${greeting},

Váš termín **${serviceName}** (${dateStr}) byl zrušen.

Pokud byste si ${chtel} v budoucnu vybrat nový termín, jste ${vitan}:
[📅 Vybrat termín](${propertyUrl})

Přeji hezký den,
${booking.provider.name}${phone ? `\nTel.: ${phone}` : ""}`;
  } else {
    clientSubject = `Děkuji za Váš čas`;
    clientBody = `${greeting},

děkuji Vám za Váš čas a zájem. Mrzí mě, že to tentokrát nevyšlo.

Pokud byste cokoliv ${potreboval} do budoucna, neváhejte se na mě obrátit.

Přeji Vám hezký den,
${booking.provider.name}${phone ? `\nTel.: ${phone}` : ""}`;
  }

  await sendEmail({
    to: booking.client.email,
    subject: clientSubject,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="color:#6b7280;font-size:13px;">${escapeHtml(booking.tenant.name)}</div>
      <div style="margin-top:8px;">${markdownishToHtml(clientBody)}</div>
    </div>`,
    replyTo,
  }).catch(() => {});

  // === Email vlastníkovi (notifikace, že klient zareagoval) ===
  const ownerEmail = booking.tenant.ownerEmail;
  if (ownerEmail) {
    const actionLabel =
      action === "reschedule"
        ? "🔄 chce PŘEPLÁNOVAT termín"
        : action === "cancel"
          ? "❌ ZRUŠIL termín"
          : "🚫 NEMÁ ZÁJEM (přestaňte kontaktovat)";
    await sendEmail({
      to: ownerEmail,
      subject: `Klient ${booking.client.name}: ${actionLabel}`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#fef3c7;color:#92400e;padding:12px 16px;border-radius:8px;font-weight:600;">
          ${actionLabel}
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:16px 0;">
          <div style="color:#1e3a8a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px;">Důvod od klienta</div>
          <div style="color:#1e293b;">${escapeHtml(reason)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 0;color:#6b7280;width:130px;">Nemovitost:</td><td><strong>${escapeHtml(serviceName)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Původní termín:</td><td>${dateStr}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Klient:</td><td>${escapeHtml(booking.client.name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Email:</td><td><a href="mailto:${booking.client.email}">${escapeHtml(booking.client.email)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Telefon:</td><td><a href="tel:${booking.client.phone}">${escapeHtml(booking.client.phone)}</a></td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;">Další automatické emaily tomuto klientovi byly zastaveny.</p>
      </div>`,
      replyTo,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, action, propertyUrl });
}

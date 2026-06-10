import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";
import { markdownishToHtml } from "@/lib/email-format";
import { calendarButtonsHtml } from "@/lib/calendar-links";
import { PUBLIC_BASE_URL } from "@/lib/base-url";
import { genderizeFormalText } from "@/lib/czech-name";
import { sendSmsRaw } from "@/lib/sms";
import { canManage } from "@/lib/perms";

const schema = z.object({
  to: z.string().email().optional(),
});

type Vars = Record<string, string>;

function applyTemplate(text: string, vars: Vars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => vars[key] ?? "");
}

const plaintextToHtml = markdownishToHtml;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant nenalezen" }, { status: 404 });

  const rule = await prisma.notificationRule.findFirst({
    where: { id: params.id, tenantId: tenant.id },
  });
  if (!rule) return NextResponse.json({ error: "Pravidlo nenalezeno" }, { status: 404 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* prázdné tělo OK */
  }
  const parsed = schema.safeParse(body);
  const recipient =
    parsed.success && parsed.data.to
      ? parsed.data.to
      : tenant.ownerEmail || session.user.email;
  if (!recipient) {
    return NextResponse.json(
      { error: "Není kam poslat — zadejte email nebo vyplňte email vlastníka." },
      { status: 400 },
    );
  }

  // Ukázková data (dummy)
  const baseUrl = PUBLIC_BASE_URL;
  const phone = tenant.ownerPhone || "724 191 620";
  const vars: Vars = {
    client_name: "Marie Nováková",
    client_first_name: "Marie",
    client_vocative: "Marie",
    client_greeting: "Dobrý den, Marie",
    client_email: "marie.novakova@example.com",
    client_phone: "+420 777 123 456",
    service_name: "Byt 3+kk, Praha 7 — Letná",
    provider_name: session.user.name ?? "Petr Zach",
    provider_phone: phone,
    provider_email: recipient,
    business_phone: phone,
    date: "15. 6. 2026",
    time: "14:30",
    location: "Strojnická 12, Praha 7",
    confirm_url: `${baseUrl}/booking/confirm/UKAZKA-TOKEN`,
    manage_url: `${baseUrl}/booking/manage/UKAZKA-TOKEN`,
    ics_url: `${baseUrl}/api/booking-ics/UKAZKA-TOKEN`,
    business_name: tenant.name,
    documents_url: "https://drive.google.com/ukazka-slozka",
    virtual_tour_url: "https://my.matterport.com/ukazka",
    property_web_url: "https://www.sreality.cz/ukazka",
    offer_form_url: `${baseUrl}/${tenant.slug}/p/ukazka/nabidka`,
    offer_url: `${baseUrl}/${tenant.slug}/p/ukazka/nabidka`,
  };

  const subject =
    "[TEST] " +
    (genderizeFormalText(applyTemplate(rule.subject ?? "", vars), vars.client_name) ||
      "Ukázková notifikace");

  if (rule.channel === "sms") {
    const message = applyTemplate(rule.body, vars);
    const res = await sendSmsRaw(recipient.includes("@") ? "+420777123456" : recipient, message);
    return NextResponse.json({
      ok: res.ok,
      channel: "sms",
      note: "SMS test odeslán na ukázkové číslo (pokud je GoSMS nastaven).",
      error: res.error,
      preview: message,
    });
  }

  let bodyHtml = plaintextToHtml(
    genderizeFormalText(applyTemplate(rule.body, vars), vars.client_name),
  );
  if (rule.includeConfirmButton) {
    bodyHtml += `
      <div style="margin: 24px 0;">
        <a href="${vars.confirm_url}" style="display:inline-block; background:#2563eb; color:white; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">
          ✅ Potvrdit termín
        </a>
      </div>`;
  }
  if (rule.includeIcs) {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    bodyHtml += calendarButtonsHtml({
      title: `${vars.service_name} — ${tenant.name}`,
      startsAt: start,
      endsAt: end,
      location: vars.location,
      icsUrl: vars.ics_url,
    });
  }
  bodyHtml = `<div style="background:#fef9c3; border:1px solid #fde047; border-radius:8px; padding:8px 12px; margin-bottom:16px; font-size:13px;">⚠️ Toto je <strong>testovací email</strong> s ukázkovými daty. Skutečnému klientovi se dosadí jeho údaje.</div>${bodyHtml}`;

  const res = await sendTemplatedEmail({
    to: recipient,
    subject,
    bodyHtml,
    businessName: tenant.name,
    replyTo: tenant.replyToEmail || tenant.ownerEmail || undefined,
  });

  return NextResponse.json({
    ok: res.ok,
    channel: "email",
    sentTo: recipient,
    error: res.error,
  });
}

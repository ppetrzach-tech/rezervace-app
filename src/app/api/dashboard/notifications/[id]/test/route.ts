import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendTemplatedEmail, escapeHtml } from "@/lib/email";
import { sendSmsRaw } from "@/lib/sms";
import { canManage } from "@/lib/perms";

const schema = z.object({
  to: z.string().email().optional(),
});

type Vars = Record<string, string>;

function applyTemplate(text: string, vars: Vars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => vars[key] ?? "");
}

function plaintextToHtml(s: string): string {
  let cleaned = s
    .split("\n")
    .filter((line) => !/\[[^\]]*\]\(\s*\)/.test(line))
    .join("\n");
  cleaned = cleaned.replace(/\[[^\]]*\]\(\s*\)/g, "");
  const links: string[] = [];
  let work = cleaned;
  work = work.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, text, url) => {
    const i = links.length;
    links.push(
      `<a href="${url}" style="color:#2563eb; text-decoration: underline;">${escapeHtml(text)}</a>`,
    );
    return ` ${i} `;
  });
  work = work.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const i = links.length;
    links.push(
      `<a href="${url}" style="color:#2563eb; text-decoration: underline;">${escapeHtml(url)}</a>`,
    );
    return ` ${i} `;
  });
  let out = escapeHtml(work);
  out = out.replace(/ (\d+) /g, (_, i) => links[parseInt(i, 10)]);
  return out.replace(/\n/g, "<br/>");
}

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
  const baseUrl = process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app";
  const vars: Vars = {
    client_name: "Marie Nováková",
    client_first_name: "Marie",
    client_email: "marie.novakova@example.com",
    client_phone: "+420 777 123 456",
    service_name: "Byt 3+kk, Praha 7 — Letná",
    provider_name: session.user.name ?? "Petr Zach",
    provider_phone: "724 191 620",
    provider_email: recipient,
    date: "15. 6. 2026",
    time: "14:30",
    location: "Strojnická 12, Praha 7",
    confirm_url: `${baseUrl}/booking/confirm/UKAZKA-TOKEN`,
    business_name: tenant.name,
    documents_url: "https://drive.google.com/ukazka-slozka",
    virtual_tour_url: "https://my.matterport.com/ukazka",
    property_web_url: "https://www.sreality.cz/ukazka",
    offer_form_url: "https://forms.gle/ukazka",
  };

  const subject =
    "[TEST] " + (applyTemplate(rule.subject ?? "", vars) || "Ukázková notifikace");

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

  let bodyHtml = plaintextToHtml(applyTemplate(rule.body, vars));
  if (rule.includeConfirmButton) {
    bodyHtml += `
      <div style="margin: 24px 0;">
        <a href="${vars.confirm_url}" style="display:inline-block; background:#2563eb; color:white; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">
          ✅ Potvrdit termín
        </a>
      </div>`;
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

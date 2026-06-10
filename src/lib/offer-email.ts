import { sendEmail, type SendEmailResult } from "./email-provider";
import { escapeHtml } from "./email";
import { formalGreeting } from "./czech-name";

export type OfferEmailData = {
  tenantName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  replyToEmail: string | null;
  listingTitle: string;
  client: { name: string; email: string; phone: string };
  amountCzk: number | null;
  financing: string | null;
  message: string | null;
  dashboardUrl: string;
};

function fmtAmount(czk: number | null): string {
  if (!czk || czk <= 0) return "neuvedeno";
  return `${new Intl.NumberFormat("cs-CZ").format(czk)} Kč`;
}

/** E-mail vlastníkovi o nové cenové nabídce. */
export async function sendOwnerNewOfferEmail(
  d: OfferEmailData,
): Promise<SendEmailResult> {
  if (!d.ownerEmail) return { ok: false, error: "ownerEmail chybí" };
  const replyTo = d.replyToEmail || d.ownerEmail || undefined;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#dcfce7;color:#166534;padding:12px 16px;border-radius:8px;font-weight:600;">
      💰 Nová cenová nabídka
    </div>
    <h2 style="margin-top:16px;">${escapeHtml(d.listingTitle)}</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:12px 0;">
      <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">Nabízená cena</div>
      <div style="font-size:26px;font-weight:700;color:#15803d;">${fmtAmount(d.amountCzk)}</div>
      ${d.financing ? `<div style="font-size:13px;color:#475569;margin-top:4px;">Financování: <strong>${escapeHtml(d.financing)}</strong></div>` : ""}
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Zájemce:</td><td><strong>${escapeHtml(d.client.name)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Email:</td><td><a href="mailto:${d.client.email}">${escapeHtml(d.client.email)}</a></td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Telefon:</td><td><a href="tel:${d.client.phone}">${escapeHtml(d.client.phone)}</a></td></tr>
      ${d.message ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">Zpráva:</td><td>${escapeHtml(d.message)}</td></tr>` : ""}
    </table>
    <a href="${d.dashboardUrl}" style="display:inline-block;background:#2563eb;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Zobrazit nabídky v systému</a>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">${escapeHtml(d.tenantName)}</p>
  </div>`;
  return sendEmail({
    to: d.ownerEmail,
    subject: `💰 Nabídka ${fmtAmount(d.amountCzk)} — ${d.listingTitle} (${d.client.name})`,
    html,
    replyTo,
  });
}

/** Potvrzení klientovi, že nabídku přijal systém. */
export async function sendOfferConfirmationToClient(
  d: OfferEmailData,
): Promise<SendEmailResult> {
  const replyTo = d.replyToEmail || d.ownerEmail || undefined;
  const greeting = formalGreeting(d.client.name);
  const phone = d.ownerPhone || "";
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <div style="color:#6b7280;font-size:13px;">${escapeHtml(d.tenantName)}</div>
    <h2 style="color:#1d4ed8;margin-top:4px;">Děkuji za Vaši nabídku</h2>
    <p>${escapeHtml(greeting)},</p>
    <p>děkuji za Vaši cenovou nabídku na <strong>${escapeHtml(d.listingTitle)}</strong>. Eviduji ji a co nejdříve se Vám ozvu.</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Nabízená cena:</td><td><strong>${fmtAmount(d.amountCzk)}</strong></td></tr>
      ${d.financing ? `<tr><td style="padding:6px 0;color:#6b7280;">Financování:</td><td>${escapeHtml(d.financing)}</td></tr>` : ""}
    </table>
    <p>Přeji hezký den,<br/>${escapeHtml(d.tenantName)}${phone ? `<br/>Tel.: ${escapeHtml(phone)}` : ""}</p>
  </div>`;
  return sendEmail({
    to: d.client.email,
    subject: `Potvrzení nabídky — ${d.listingTitle}`,
    html,
    replyTo,
  });
}

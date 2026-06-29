import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email-provider";
import { escapeHtml } from "@/lib/email";
import { PUBLIC_BASE_URL } from "@/lib/base-url";

const schema = z.object({ email: z.string().trim().email() });

/**
 * Zahájení obnovy hesla. Vždy vrací OK (neprozrazuje, zda účet existuje).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      try {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hodina
          },
        });
        const link = `${PUBLIC_BASE_URL}/reset-password?token=${token}`;
        await sendEmail({
          to: user.email,
          subject: "Obnovení hesla",
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            <h2 style="color:#1d4ed8;">Obnovení hesla</h2>
            <p>Dobrý den,</p>
            <p>někdo (snad vy) požádal o obnovení hesla k vašemu účtu. Nové heslo si nastavíte zde:</p>
            <p style="margin:20px 0;">
              <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Nastavit nové heslo</a>
            </p>
            <p style="color:#6b7280;font-size:13px;">Odkaz platí <strong>1 hodinu</strong>. Pokud jste o obnovení nežádal/a, tento e-mail ignorujte — heslo zůstává beze změny.</p>
            <p style="color:#94a3b8;font-size:12px;word-break:break-all;">${escapeHtml(link)}</p>
          </div>`,
        });
      } catch (e) {
        console.warn("[forgot] ", e);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

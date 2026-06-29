import crypto from "crypto";
import { prisma } from "./db";
import { sendEmail } from "./email-provider";
import { escapeHtml } from "./email";
import { czDateTimeLong } from "./datetime";

type ReqLike = {
  headers?: Record<string, string | string[] | undefined>;
} | undefined;

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export function lockMinutes() {
  return LOCK_MINUTES;
}

export function isLocked(user: { lockedUntil: Date | null }): boolean {
  return !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();
}

/** Zvýší počítadlo neúspěšných pokusů a po překročení limitu účet dočasně zamkne. */
export async function recordFailedLogin(user: {
  id: string;
  failedLogins: number;
}): Promise<void> {
  const fails = (user.failedLogins ?? 0) + 1;
  await prisma.user
    .update({
      where: { id: user.id },
      data: {
        failedLogins: fails,
        lockedUntil:
          fails >= MAX_FAILS
            ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
            : null,
      },
    })
    .catch(() => {});
}

export async function resetFailedLogins(user: {
  id: string;
  failedLogins: number;
  lockedUntil: Date | null;
}): Promise<void> {
  if (user.failedLogins > 0 || user.lockedUntil) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      })
      .catch(() => {});
  }
}

function fingerprintFromReq(req: ReqLike): { fp: string; ua: string; ip: string } {
  const h = req?.headers ?? {};
  const get = (k: string) => {
    const v = h[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const ua = String(get("user-agent")).slice(0, 300);
  const ip = String(get("x-forwarded-for") || get("x-real-ip"))
    .split(",")[0]
    .trim();
  const fp = crypto.createHash("sha256").update(`${ua}|${ip}`).digest("hex");
  return { fp, ua, ip };
}

/** Stručný, čitelný popis zařízení z user-agenta. */
function describeDevice(ua: string): string {
  const s = ua.toLowerCase();
  const os = s.includes("iphone")
    ? "iPhone"
    : s.includes("ipad")
      ? "iPad"
      : s.includes("android")
        ? "Android"
        : s.includes("mac os") || s.includes("macintosh")
          ? "Mac"
          : s.includes("windows")
            ? "Windows"
            : "neznámé zařízení";
  const br = s.includes("edg/")
    ? "Edge"
    : s.includes("chrome")
      ? "Chrome"
      : s.includes("firefox")
        ? "Firefox"
        : s.includes("safari")
          ? "Safari"
          : "prohlížeč";
  return `${br} · ${os}`;
}

/**
 * Po úspěšném přihlášení: pokud je to nové zařízení, pošle vlastníkovi
 * upozornění e-mailem. První zařízení (vůbec první přihlášení) se nehlásí,
 * aby to nešumělo. Nikdy nevyhodí chybu (login nesmí selhat kvůli tomuhle).
 */
export async function notifyIfNewDevice(
  user: { id: string; email: string },
  req: ReqLike,
): Promise<void> {
  try {
    const { fp, ua } = fingerprintFromReq(req);
    const existing = await prisma.loginDevice.findUnique({
      where: { userId_fingerprint: { userId: user.id, fingerprint: fp } },
    });
    if (existing) {
      await prisma.loginDevice
        .update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } })
        .catch(() => {});
      return;
    }
    await prisma.loginDevice.create({
      data: { userId: user.id, fingerprint: fp, userAgent: ua },
    });
    const count = await prisma.loginDevice.count({ where: { userId: user.id } });
    if (count <= 1) return; // první zařízení → neupozorňovat

    await sendEmail({
      to: user.email,
      subject: "🔐 Nové přihlášení do vašeho účtu",
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#1d4ed8;">Nové přihlášení</h2>
        <p>Zaznamenali jsme přihlášení do vašeho účtu z <strong>nového zařízení</strong>:</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Kdy:</td><td>${czDateTimeLong(new Date())}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Zařízení:</td><td>${escapeHtml(describeDevice(ua))}</td></tr>
        </table>
        <p style="color:#475569;">Pokud jste to byl/a vy, nic neřešte. Pokud ne, co nejdříve si <strong>změňte heslo</strong> přes „Zapomněl jsem heslo" na přihlašovací stránce.</p>
      </div>`,
    });
  } catch (e) {
    console.warn("[login-alert]", e);
  }
}

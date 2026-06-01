import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getServiceAccountEmail, isCalendarConfigured } from "@/lib/google-calendar";
import { GoogleCalendarForm } from "./GoogleCalendarForm";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant) redirect("/login");

  const resendOk = !!process.env.RESEND_API_KEY;
  const ecomailOk = !!process.env.ECOMAIL_API_KEY;
  const emailProviderName = ecomailOk ? "Ecomail" : resendOk ? "Resend" : null;
  const gosmsOk = !!(
    process.env.GOSMS_CLIENT_ID && process.env.GOSMS_CLIENT_SECRET
  );
  const gcalGloballyOk = isCalendarConfigured();
  const serviceAccountEmail = getServiceAccountEmail();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Integrace</h2>
        <p className="text-slate-600 text-sm">
          Napojení na Google Calendar, email a SMS.
        </p>
      </div>

      <GoogleCalendarForm
        gcalGloballyOk={gcalGloballyOk}
        serviceAccountEmail={serviceAccountEmail}
        initial={{
          ownerEmail: tenant.ownerEmail ?? "",
          replyToEmail: tenant.replyToEmail ?? "",
          googleCalendarId: tenant.googleCalendarId ?? "",
          googleTimezone: tenant.googleTimezone,
        }}
      />

      <div className="card">
        <h3 className="font-semibold flex items-center gap-2">
          <span>📧</span>
          <span>Odesílání emailů</span>
          {emailProviderName ? (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 ml-auto">
              ✓ {emailProviderName}
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 ml-auto">
              ⚠ nenakonfigurováno
            </span>
          )}
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Aplikace podporuje dvě email služby — stačí jedna. Pokud máte obě
          nakonfigurované, použije se Ecomail.
        </p>
      </div>

      <IntegrationCard
        name="Ecomail (transakční email)"
        emoji="✉️"
        connected={ecomailOk}
        description="Český provider, transakční API. Pokud už ho používáte, ideální. Vyžaduje aktivovaný transakční plán."
        setupSteps={[
          "V Ecomail dashboardu → Nastavení → API klíče",
          "Vygenerujte API klíč",
          "(Volitelné) ověřte svou doménu pro lepší doručitelnost",
          "Přidejte do Vercel Settings → Environment Variables:",
        ]}
        envVars={[
          { key: "ECOMAIL_API_KEY", example: "..." },
          {
            key: "EMAIL_FROM",
            example: "Vaše firma <noreply@vasedomena.cz>",
          },
        ]}
        link="https://ecomail.cz"
      />

      <IntegrationCard
        name="Resend (transakční email)"
        emoji="✉️"
        connected={resendOk}
        description="Alternativa k Ecomailu. Zdarma 100 emailů/den, snadné nastavení."
        setupSteps={[
          "Zaregistrujte se na resend.com (zdarma)",
          "Vygenerujte API klíč",
          "Verifikujte vlastní doménu",
          "Přidejte do Vercel Settings → Environment Variables:",
        ]}
        envVars={[
          { key: "RESEND_API_KEY", example: "re_xxxxxxxxx" },
          {
            key: "EMAIL_FROM",
            example: "Vaše firma <noreply@vasedomena.cz>",
          },
        ]}
        link="https://resend.com"
      />

      <IntegrationCard
        name="GoSMS (SMS)"
        emoji="📱"
        connected={gosmsOk}
        description="Odesílá SMS notifikace klientům (např. připomínky pár hodin před schůzkou)."
        setupSteps={[
          "Zaregistrujte se na gosms.cz",
          "Vytvořte OAuth2 klienta — získáte Client ID a Secret",
          "V administraci najděte ID kanálu (Channel ID)",
          "Přidejte do Vercel Settings → Environment Variables:",
        ]}
        envVars={[
          { key: "GOSMS_CLIENT_ID", example: "..." },
          { key: "GOSMS_CLIENT_SECRET", example: "..." },
          { key: "GOSMS_CHANNEL_ID", example: "..." },
          { key: "GOSMS_SENDER", example: "VaseFirma (volitelné)" },
        ]}
        link="https://gosms.cz"
      />

      <IntegrationCard
        name="Externí cron (cron-job.org)"
        emoji="⏰"
        connected={null}
        description="Spouští notifikační engine každých 15 min. Bez něj Vercel Hobby umí jen 1× denně."
        setupSteps={[
          "Zaregistrujte se na console.cron-job.org (zdarma)",
          "Create cronjob:",
          "URL: https://vase-doména.cz/api/cron/notifications?token=VAS_CRON_SECRET",
          "Schedule: Every 15 minutes",
          "Save ✓",
        ]}
        envVars={[]}
        link="https://console.cron-job.org/signup"
      />
    </div>
  );
}

function IntegrationCard({
  name,
  emoji,
  connected,
  description,
  setupSteps,
  envVars,
  link,
}: {
  name: string;
  emoji: string;
  connected: boolean | null;
  description: string;
  setupSteps: string[];
  envVars: { key: string; example: string }[];
  link: string;
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <span>{emoji}</span>
            <span>{name}</span>
          </h3>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
        {connected === true && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
            ✓ připojeno
          </span>
        )}
        {connected === false && (
          <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 shrink-0">
            ⚠ nenapojeno
          </span>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-brand-700 hover:underline">
          Jak nastavit
        </summary>
        <ol className="mt-2 space-y-1 text-slate-600 list-decimal list-inside">
          {setupSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {envVars.length > 0 && (
          <div className="mt-2 bg-slate-50 rounded-lg p-2 font-mono text-xs space-y-0.5">
            {envVars.map((v) => (
              <div key={v.key}>
                {v.key}=<span className="text-slate-400">{v.example}</span>
              </div>
            ))}
          </div>
        )}
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-brand-700 hover:underline"
        >
          {link} ↗
        </a>
      </details>
    </div>
  );
}

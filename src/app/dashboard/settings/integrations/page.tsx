import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Detekce, jestli jsou nastavené API klíče (jen check existence)
  const resendOk = !!process.env.RESEND_API_KEY;
  const gosmsOk = !!(
    process.env.GOSMS_CLIENT_ID && process.env.GOSMS_CLIENT_SECRET
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Integrace</h2>
        <p className="text-slate-600 text-sm">
          Stav napojení na externí služby pro odesílání emailů a SMS.
        </p>
      </div>

      <IntegrationCard
        name="Resend (Email)"
        emoji="📧"
        connected={resendOk}
        description="Odesílá potvrzovací a připomínkové emaily klientům."
        setupSteps={[
          "Zaregistrujte se na resend.com (zdarma 100 emailů/den)",
          "Vygenerujte API klíč",
          "Verifikujte vlastní doménu",
          "Přidejte do Vercel Settings → Environment Variables:",
        ]}
        envVars={[
          { key: "RESEND_API_KEY", example: "re_xxxxxxxxx" },
          {
            key: "EMAIL_FROM",
            example: `Vaše firma <noreply@vasedomena.cz>`,
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

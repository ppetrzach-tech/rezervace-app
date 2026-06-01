"use client";

import { useState } from "react";

export function GoogleCalendarForm({
  gcalGloballyOk,
  serviceAccountEmail,
  initial,
}: {
  gcalGloballyOk: boolean;
  serviceAccountEmail: string | null;
  initial: {
    ownerEmail: string;
    replyToEmail: string;
    googleCalendarId: string;
    googleTimezone: string;
  };
}) {
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: json.error ?? "Uložení selhalo" });
      } else {
        setMsg({ ok: true, text: "Uloženo." });
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function testAccess() {
    if (!data.googleCalendarId) {
      setMsg({ ok: false, text: "Nejdřív vyplňte Calendar ID a uložte." });
      return;
    }
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/integrations/test-calendar", {
        method: "POST",
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({
          ok: true,
          text: `✓ Funguje! Připojen ke kalendáři: ${json.calendarSummary ?? "(bez názvu)"}`,
        });
      } else {
        setMsg({ ok: false, text: json.error ?? "Test selhal" });
      }
    } finally {
      setTesting(false);
    }
  }

  async function copyEmail() {
    if (!serviceAccountEmail) return;
    await navigator.clipboard.writeText(serviceAccountEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <span>📅</span>
            <span>Google Calendar + Email vlastníka</span>
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Při každé nové rezervaci:
            <br />
            <strong>1.</strong> vám přijde email s detaily
            <br />
            <strong>2.</strong> událost se okamžitě objeví ve vašem Google Calendar
          </p>
        </div>
        {!gcalGloballyOk && (
          <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 shrink-0">
            ⚠ Service Account není nakonfigurován
          </span>
        )}
        {gcalGloballyOk && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
            ✓ Service Account OK
          </span>
        )}
      </div>

      {!gcalGloballyOk && (
        <details className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
          <summary className="cursor-pointer font-medium text-orange-900">
            Jak nastavit Service Account (jednorázově, ~10 minut)
          </summary>
          <ol className="mt-2 space-y-1.5 list-decimal list-inside text-orange-900">
            <li>
              Otevřete{" "}
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                console.cloud.google.com
              </a>{" "}
              a přihlaste se svým Google účtem
            </li>
            <li>
              Nahoře vyberte <strong>New Project</strong> → název:{" "}
              <code>rezervace-app</code> → Create
            </li>
            <li>
              V menu <strong>APIs & Services → Library</strong> → vyhledejte{" "}
              <strong>Google Calendar API</strong> → Enable
            </li>
            <li>
              <strong>APIs & Services → Credentials</strong> → Create Credentials →{" "}
              <strong>Service Account</strong>
              <ul className="ml-5 list-disc">
                <li>Name: <code>rezervace-calendar</code></li>
                <li>Klikněte Done (role a permissions vynechte)</li>
              </ul>
            </li>
            <li>
              Klikněte na vytvořený service account → záložka <strong>Keys</strong> →{" "}
              <strong>Add Key → Create new key → JSON</strong> → soubor se stáhne
            </li>
            <li>
              Otevřete stažený <code>.json</code> a najděte:
              <ul className="ml-5 list-disc">
                <li>
                  <code>client_email</code> — zkopírujte hodnotu
                </li>
                <li>
                  <code>private_key</code> — zkopírujte hodnotu (celá, včetně{" "}
                  <code>-----BEGIN PRIVATE KEY-----</code>)
                </li>
              </ul>
            </li>
            <li>
              V <strong>Vercel</strong> → Project → Settings → Environment Variables
              přidejte:
              <div className="bg-white border border-orange-300 rounded p-2 mt-1 font-mono text-xs">
                <div>GOOGLE_SERVICE_ACCOUNT_EMAIL=client_email...</div>
                <div>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=&quot;-----BEGIN...&quot;</div>
              </div>
            </li>
            <li>Redeploy projektu. Pak se sem vraťte a uvidíte ✓ Service Account OK.</li>
          </ol>
        </details>
      )}

      <div className="space-y-3 pt-2 border-t border-slate-200">
        <div>
          <label className="label">📧 Váš email pro notifikace</label>
          <input
            type="email"
            className="input"
            placeholder="petr@vasarealitka.cz"
            value={data.ownerEmail}
            onChange={(e) => setData({ ...data, ownerEmail: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">
            Sem vám přijde email u každé nové rezervace. Může být jiný než login.
          </p>
        </div>

        <div>
          <label className="label">↩️ Reply-To (kam chodí odpovědi klientů)</label>
          <input
            type="email"
            className="input"
            placeholder="petr@zach-petr.cz"
            value={data.replyToEmail}
            onChange={(e) => setData({ ...data, replyToEmail: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">
            Emaily klientovi se odesílají z <code>noreply@…</code>, ale když klient
            klikne „Odpovědět", dorazí to sem. Když necháte prázdné, použije se email
            pro notifikace výše.
          </p>
        </div>

        {gcalGloballyOk && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-900">
                Krok 1: Nasdílejte svůj Google Calendar
              </p>
              <p className="text-blue-900 mt-1">
                V Google Calendar najděte svůj kalendář → 3 tečky → Settings and sharing
                → Share with specific people → Add people → vložte email níže →
                permission „Make changes to events" → Send.
              </p>
              {serviceAccountEmail ? (
                <div className="bg-white border border-blue-300 rounded p-2 mt-2 font-mono text-xs break-all flex justify-between gap-2 items-center">
                  <span>{serviceAccountEmail}</span>
                  <button
                    onClick={copyEmail}
                    className="text-blue-700 hover:underline shrink-0"
                  >
                    {copied ? "✓ Zkopírováno" : "Kopírovat"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-red-700 mt-2">
                  GOOGLE_SERVICE_ACCOUNT_EMAIL není nastavený.
                </p>
              )}
            </div>

            <div>
              <label className="label">📅 Krok 2: Calendar ID</label>
              <input
                className="input"
                placeholder="petr@gmail.com nebo abc...@group.calendar.google.com"
                value={data.googleCalendarId}
                onChange={(e) =>
                  setData({ ...data, googleCalendarId: e.target.value })
                }
              />
              <p className="text-xs text-slate-500 mt-1">
                Pro hlavní kalendář = váš Gmail email.
                <br />
                Pro vlastní kalendář (např. „Prohlídky") = v Google Calendar Settings →
                vyberte kalendář → scrollujte na <strong>Calendar ID</strong> (vypadá
                jako náhodný řetězec končící <code>@group.calendar.google.com</code>).
              </p>
            </div>

            <div>
              <label className="label">🌍 Časové pásmo</label>
              <select
                className="input"
                value={data.googleTimezone}
                onChange={(e) =>
                  setData({ ...data, googleTimezone: e.target.value })
                }
              >
                <option value="Europe/Prague">Europe/Prague (čas v ČR)</option>
                <option value="Europe/Bratislava">Europe/Bratislava</option>
                <option value="Europe/Vienna">Europe/Vienna</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="Europe/London">Europe/London</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </>
        )}

        {msg && (
          <p
            className={`text-sm ${
              msg.ok ? "text-green-600" : "text-red-600"
            }`}
          >
            {msg.text}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Ukládám…" : "Uložit"}
          </button>
          {gcalGloballyOk && (
            <button
              onClick={testAccess}
              disabled={testing}
              className="btn-secondary"
            >
              {testing ? "Testuji…" : "Otestovat připojení"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

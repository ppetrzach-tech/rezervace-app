"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Rule = {
  id: string;
  name: string;
  channel: "email" | "sms";
  offsetMinutes: number; // záporné = před, kladné = po
  subject: string;
  body: string;
  includeIcs: boolean;
  includeConfirmButton: boolean;
  onlyIfNotConfirmed: boolean;
  enabled: boolean;
};

const emptyRule: Omit<Rule, "id"> = {
  name: "",
  channel: "email",
  offsetMinutes: -24 * 60,
  subject: "",
  body: "",
  includeIcs: false,
  includeConfirmButton: false,
  onlyIfNotConfirmed: false,
  enabled: true,
};

const PRESETS: Array<Omit<Rule, "id"> & { presetName: string }> = [
  {
    presetName: "📧 Potvrzení 24 h před",
    name: "24h email s potvrzením",
    channel: "email",
    offsetMinutes: -24 * 60,
    subject: "Připomínka: zítra máte schůzku",
    body:
      "Dobrý den {{client_name}},\n\nzítra v {{time}} máte schůzku ({{service_name}}) — {{location}}.\n\nPotvrďte prosím kliknutím níže, že přijdete.",
    includeIcs: true,
    includeConfirmButton: true,
    onlyIfNotConfirmed: false,
    enabled: true,
  },
  {
    presetName: "📱 SMS 2 h před (pokud nepotvrzeno)",
    name: "SMS fallback 2h před",
    channel: "sms",
    offsetMinutes: -2 * 60,
    subject: "",
    body:
      "Pripominam zitra ({{date}}) v {{time}}: {{service_name}}. Tesim se. {{business_name}}",
    includeIcs: false,
    includeConfirmButton: false,
    onlyIfNotConfirmed: true,
    enabled: true,
  },
  {
    presetName: "🙏 Poděkování 15 min po",
    name: "Poděkování po schůzce",
    channel: "email",
    offsetMinutes: 15,
    subject: "Děkujeme za schůzku",
    body:
      "Dobrý den {{client_name}},\n\nděkujeme, že jste si dnes udělal/a čas. Pokud máte jakékoliv dotazy, odpovězte na tento email.\n\n{{business_name}}",
    includeIcs: false,
    includeConfirmButton: false,
    onlyIfNotConfirmed: false,
    enabled: true,
  },
  {
    presetName: "📧 Follow-up 24 h po",
    name: "Follow-up 24h po",
    channel: "email",
    offsetMinutes: 24 * 60,
    subject: "Jak jste s prohlídkou spokojen/á?",
    body:
      "Dobrý den {{client_name}},\n\nvčera jsme se viděli. Měl/a jste možnost vše promyslet? Rád/a si s vámi popovídám o dalších krocích.\n\n{{business_name}}",
    includeIcs: false,
    includeConfirmButton: false,
    onlyIfNotConfirmed: false,
    enabled: true,
  },
  {
    presetName: "📧 Druhý follow-up 48 h po",
    name: "Follow-up 48h po",
    channel: "email",
    offsetMinutes: 48 * 60,
    subject: "Ještě jeden krátký dotaz",
    body:
      "Dobrý den {{client_name}},\n\nstále čekáme na vaši zpětnou vazbu — pokud o nabídku máte zájem, dejte nám prosím vědět.\n\n{{business_name}}",
    includeIcs: false,
    includeConfirmButton: false,
    onlyIfNotConfirmed: false,
    enabled: true,
  },
];

function offsetLabel(min: number): string {
  if (min === 0) return "v čase schůzky";
  const abs = Math.abs(min);
  let s = "";
  if (abs >= 60) s = `${Math.floor(abs / 60)} h ${abs % 60 ? `${abs % 60} min` : ""}`.trim();
  else s = `${abs} min`;
  return min < 0 ? `${s} před` : `${s} po`;
}

export function NotificationsManager({
  initialRules,
}: {
  initialRules: Rule[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState<Omit<Rule, "id"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(rule: Rule | Omit<Rule, "id">) {
    setSaving(true);
    setError(null);
    const isEdit = "id" in rule;
    try {
      const res = await fetch(
        isEdit
          ? `/api/dashboard/notifications/${rule.id}`
          : "/api/dashboard/notifications",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rule),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Uložení selhalo");
        return;
      }
      setEditing(null);
      setCreating(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Smazat pravidlo?")) return;
    const res = await fetch(`/api/dashboard/notifications/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Smazání selhalo");
      return;
    }
    router.refresh();
  }

  async function sendTest(id: string) {
    const to = prompt(
      "Na jaký email poslat testovací ukázku?\n(Nechte prázdné = pošle se na váš email vlastníka.)",
    );
    if (to === null) return; // zrušeno
    const res = await fetch(`/api/dashboard/notifications/${id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(to ? { to } : {}),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.ok) {
      alert(
        j.channel === "sms"
          ? `✅ Testovací SMS odeslána.\n\nNáhled:\n${j.preview ?? ""}`
          : `✅ Testovací email odeslán na ${j.sentTo}.\n\nZkontrolujte schránku (i spam).`,
      );
    } else {
      alert(
        `❌ Nepodařilo se odeslat.\n${j.error ?? "Zkontrolujte, že je nastaven email provider (Ecomail/Resend)."}`,
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="card bg-brand-50 border-brand-200">
        <h3 className="font-semibold mb-2">Dostupné proměnné</h3>
        <p className="text-sm text-slate-700 mb-2">
          V předmětu a textu můžete použít:
        </p>
        <code className="text-xs">
          {`{{client_name}} · {{service_name}} · {{provider_name}} · {{date}} · {{time}} · {{location}} · {{confirm_url}} · {{business_name}}`}
        </code>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" onClick={() => setCreating({ ...emptyRule })}>
          + Vlastní pravidlo
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.presetName}
            className="btn-secondary text-xs"
            onClick={() => {
              const { presetName: _, ...rule } = p;
              setCreating(rule);
            }}
          >
            {p.presetName}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {initialRules.map((r) => (
          <div key={r.id} className="card">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <h3 className="font-semibold">
                  {r.channel === "email" ? "📧" : "📱"} {r.name}{" "}
                  {!r.enabled && (
                    <span className="text-xs text-slate-400">(vypnuto)</span>
                  )}
                </h3>
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  <div>⏰ {offsetLabel(r.offsetMinutes)}</div>
                  {r.subject && <div>📝 {r.subject}</div>}
                  {r.includeIcs && <div>📅 přiloží kalendářovou událost</div>}
                  {r.includeConfirmButton && <div>✅ obsahuje potvrzovací tlačítko</div>}
                  {r.onlyIfNotConfirmed && (
                    <div>↪️ jen pokud klient ještě nepotvrdil</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => sendTest(r.id)}
                  className="text-sm text-green-700 hover:underline"
                  title="Poslat testovací email s ukázkovými daty"
                >
                  📤 Test
                </button>
                <button
                  onClick={() => setEditing({ ...r })}
                  className="text-sm text-brand-700 hover:underline"
                >
                  Upravit
                </button>
                <button
                  onClick={() => remove(r.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Smazat
                </button>
              </div>
            </div>
          </div>
        ))}
        {initialRules.length === 0 && (
          <div className="card text-center text-slate-500">
            Žádná pravidla. Použijte šablony výše nebo vytvořte vlastní.
          </div>
        )}
      </div>

      {(editing || creating) && (
        <RuleForm
          initial={editing ?? creating!}
          saving={saving}
          error={error}
          onCancel={() => {
            setEditing(null);
            setCreating(null);
            setError(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function RuleForm({
  initial,
  saving,
  error,
  onCancel,
  onSave,
}: {
  initial: Rule | Omit<Rule, "id">;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (r: Rule | Omit<Rule, "id">) => void;
}) {
  const [data, setData] = useState(initial);
  const isEdit = "id" in initial;

  // Helper pro hezky zobrazení offset jako "X hodin/minut před/po"
  const absMin = Math.abs(data.offsetMinutes);
  const direction = data.offsetMinutes <= 0 ? "before" : "after";
  const [hours, setHours] = useState(Math.floor(absMin / 60));
  const [minutes, setMinutes] = useState(absMin % 60);
  const [dir, setDir] = useState<"before" | "after">(direction);

  function updateOffset(h: number, m: number, d: "before" | "after") {
    const total = h * 60 + m;
    setData({ ...data, offsetMinutes: d === "before" ? -total : total });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between">
          <h2 className="text-xl font-semibold">
            {isEdit ? "Upravit pravidlo" : "Nové pravidlo"}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(data);
          }}
          className="p-6 space-y-4"
        >
          <div>
            <label className="label">Název pravidla (jen pro vás) *</label>
            <input
              required
              className="input"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kanál *</label>
              <select
                className="input"
                value={data.channel}
                onChange={(e) => setData({ ...data, channel: e.target.value as "email" | "sms" })}
              >
                <option value="email">📧 Email</option>
                <option value="sms">📱 SMS</option>
              </select>
            </div>
            <div>
              <label className="label">Aktivní</label>
              <label className="flex items-center gap-2 mt-2 text-sm">
                <input
                  type="checkbox"
                  checked={data.enabled}
                  onChange={(e) => setData({ ...data, enabled: e.target.checked })}
                />
                Pravidlo je zapnuté
              </label>
            </div>
          </div>

          <div>
            <label className="label">Kdy odeslat (vzhledem k začátku schůzky)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                className="input w-20"
                value={hours}
                onChange={(e) => {
                  const h = parseInt(e.target.value) || 0;
                  setHours(h);
                  updateOffset(h, minutes, dir);
                }}
              />
              <span>h</span>
              <input
                type="number"
                min={0}
                max={59}
                className="input w-20"
                value={minutes}
                onChange={(e) => {
                  const m = parseInt(e.target.value) || 0;
                  setMinutes(m);
                  updateOffset(hours, m, dir);
                }}
              />
              <span>min</span>
              <select
                className="input w-32"
                value={dir}
                onChange={(e) => {
                  const d = e.target.value as "before" | "after";
                  setDir(d);
                  updateOffset(hours, minutes, d);
                }}
              >
                <option value="before">před schůzkou</option>
                <option value="after">po schůzce</option>
              </select>
            </div>
          </div>

          {data.channel === "email" && (
            <div>
              <label className="label">Předmět emailu *</label>
              <input
                required
                className="input"
                value={data.subject}
                onChange={(e) => setData({ ...data, subject: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="label">
              {data.channel === "email" ? "Text emailu *" : "Text SMS *"}
            </label>
            <textarea
              required
              rows={6}
              className="input font-mono text-sm"
              value={data.body}
              onChange={(e) => setData({ ...data, body: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">
              Můžete použít {"{{client_name}}, {{service_name}}, {{date}}, {{time}}, {{location}}, {{confirm_url}}, {{business_name}}"}
            </p>
          </div>

          {data.channel === "email" && (
            <div className="space-y-2">
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.includeIcs}
                  onChange={(e) => setData({ ...data, includeIcs: e.target.checked })}
                />
                Přiložit kalendářovou událost (.ics)
              </label>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.includeConfirmButton}
                  onChange={(e) =>
                    setData({ ...data, includeConfirmButton: e.target.checked })
                  }
                />
                Přidat tlačítko „Potvrdit termín" (klient klikne = označí rezervaci jako potvrzenou)
              </label>
            </div>
          )}

          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.onlyIfNotConfirmed}
              onChange={(e) =>
                setData({ ...data, onlyIfNotConfirmed: e.target.checked })
              }
            />
            Poslat pouze pokud klient ještě nepotvrdil (typicky pro SMS fallback)
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Zrušit
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

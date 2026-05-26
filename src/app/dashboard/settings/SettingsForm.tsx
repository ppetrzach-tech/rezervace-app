"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Settings = {
  slug: string;
  name: string;
  tagline: string;
  primaryColor: string;
};

const COLOR_PRESETS = [
  { hex: "2563eb", label: "Modrá" },
  { hex: "db2777", label: "Růžová" },
  { hex: "16a34a", label: "Zelená" },
  { hex: "9333ea", label: "Fialová" },
  { hex: "ea580c", label: "Oranžová" },
  { hex: "0891b2", label: "Tyrkysová" },
  { hex: "475569", label: "Šedá" },
];

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: json.error ?? "Uložení selhalo" });
        return;
      }
      setMsg({ type: "ok", text: "Uloženo." });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <label className="label">Název firmy *</label>
        <input
          required
          className="input"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Podtitulek (tagline)</label>
        <input
          className="input"
          placeholder="Rezervujte si termín online"
          value={data.tagline}
          onChange={(e) => setData({ ...data, tagline: e.target.value })}
        />
      </div>
      <div>
        <label className="label">URL stránky *</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">…/</span>
          <input
            required
            className="input"
            value={data.slug}
            onChange={(e) =>
              setData({
                ...data,
                slug: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-")
                  .replace(/^-+|-+$/g, ""),
              })
            }
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Klienti rezervují na <code>vase-doména.cz/{data.slug}</code>
        </p>
      </div>
      <div>
        <label className="label">Hlavní barva</label>
        <div className="flex gap-2 flex-wrap">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setData({ ...data, primaryColor: c.hex })}
              className={`w-10 h-10 rounded-lg border-2 ${
                data.primaryColor === c.hex ? "border-slate-900" : "border-slate-200"
              }`}
              style={{ backgroundColor: `#${c.hex}` }}
              title={c.label}
            />
          ))}
        </div>
        <input
          className="input mt-3 w-32 font-mono"
          value={data.primaryColor}
          onChange={(e) =>
            setData({ ...data, primaryColor: e.target.value.replace(/[^0-9a-fA-F]/g, "") })
          }
          maxLength={6}
        />
        <p className="text-xs text-slate-500 mt-1">Hex bez #</p>
      </div>

      {msg && (
        <p
          className={`text-sm ${
            msg.type === "ok" ? "text-green-600" : "text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Ukládám…" : "Uložit"}
      </button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function autoSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function NewPropertyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    slug: "",
    address: "",
    description: "",
    durationMinutes: 30,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Uložení selhalo");
        setSaving(false);
        return;
      }
      router.push(`/dashboard/properties/${json.id}`);
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Nová nemovitost</h1>
      <form onSubmit={save} className="card space-y-4">
        <div>
          <label className="label">Název *</label>
          <input
            required
            className="input"
            placeholder="např. Byt 3+kk Praha 7, Letná"
            value={form.title}
            onChange={(e) =>
              setForm({
                ...form,
                title: e.target.value,
                slug: form.slug || autoSlug(e.target.value),
              })
            }
          />
        </div>
        <div>
          <label className="label">URL slug *</label>
          <input
            required
            className="input"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: autoSlug(e.target.value) })}
          />
          <p className="text-xs text-slate-500 mt-1">
            Veřejný odkaz: <code>…/p/{form.slug || "vase-url"}</code>
          </p>
        </div>
        <div>
          <label className="label">Adresa</label>
          <input
            className="input"
            placeholder="např. Strojnická 12, Praha 7"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Popis</label>
          <textarea
            className="input"
            rows={4}
            placeholder="Krátký popis nemovitosti, který klient uvidí…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Trvání prohlídky (min) *</label>
          <input
            type="number"
            min={5}
            step={5}
            required
            className="input w-32"
            value={form.durationMinutes}
            onChange={(e) =>
              setForm({ ...form, durationMinutes: parseInt(e.target.value) || 30 })
            }
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/properties")}
            className="btn-secondary"
          >
            Zrušit
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Vytvářím…" : "Vytvořit a pokračovat"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Po vytvoření přidáte termíny a otázky.
        </p>
      </form>
    </div>
  );
}

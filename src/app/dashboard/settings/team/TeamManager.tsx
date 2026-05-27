"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Provider = {
  id: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  active: boolean;
};

const empty: Omit<Provider, "id"> = {
  name: "",
  email: "",
  phone: "",
  bio: "",
  active: true,
};

export function TeamManager({
  initialProviders,
}: {
  initialProviders: Provider[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Provider | null>(null);
  const [creating, setCreating] = useState<Omit<Provider, "id"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(data: Provider | Omit<Provider, "id">) {
    setSaving(true);
    setError(null);
    const isEdit = "id" in data;
    try {
      const res = await fetch(
        isEdit ? `/api/dashboard/providers/${data.id}` : "/api/dashboard/providers",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
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
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Opravdu deaktivovat tuto osobu? Historie rezervací zůstane.")) return;
    const res = await fetch(`/api/dashboard/providers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Smazání selhalo");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setCreating({ ...empty })}>
          + Přidat osobu
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {initialProviders.map((p) => (
          <div key={p.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">
                  {p.name}{" "}
                  {!p.active && <span className="text-xs text-slate-400">(neaktivní)</span>}
                </h3>
                {p.bio && <p className="text-sm text-slate-600 mt-1">{p.bio}</p>}
                <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                  {p.email && <div>📧 {p.email}</div>}
                  {p.phone && <div>📱 {p.phone}</div>}
                </div>
              </div>
              <div className="flex gap-2 ml-2">
                <button
                  onClick={() => setEditing({ ...p })}
                  className="text-sm text-brand-700 hover:underline"
                >
                  Upravit
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Smazat
                </button>
              </div>
            </div>
          </div>
        ))}
        {initialProviders.length === 0 && (
          <div className="card text-center text-slate-500 md:col-span-2">
            Zatím nemáte žádné osoby. Přidejte vás nebo členy týmu.
          </div>
        )}
      </div>

      {(editing || creating) && (
        <ProviderForm
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

function ProviderForm({
  initial,
  saving,
  error,
  onCancel,
  onSave,
}: {
  initial: Provider | Omit<Provider, "id">;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (p: Provider | Omit<Provider, "id">) => void;
}) {
  const [data, setData] = useState(initial);
  const isEdit = "id" in initial;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between">
          <h2 className="text-xl font-semibold">
            {isEdit ? "Upravit osobu" : "Nová osoba"}
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
            <label className="label">Jméno *</label>
            <input
              required
              className="input"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input
              type="tel"
              className="input"
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Krátký popisek (bio)</label>
            <textarea
              rows={2}
              className="input"
              placeholder="např. Kadeřnice s 10letou praxí. Specialistka na barvení."
              value={data.bio}
              onChange={(e) => setData({ ...data, bio: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.active}
                onChange={(e) => setData({ ...data, active: e.target.checked })}
              />
              Aktivní (přijímá rezervace)
            </label>
          </div>

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

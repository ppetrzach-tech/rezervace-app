"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Service = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCzk: number;
  showPrice: boolean;
  locationType: string;
  locationDetail: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  active: boolean;
  providerIds: string[];
};

const emptyService: Omit<Service, "id"> = {
  name: "",
  description: "",
  durationMinutes: 60,
  priceCzk: 0,
  showPrice: true,
  locationType: "in_person",
  locationDetail: "",
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  active: true,
  providerIds: [],
};

export function ServicesManager({
  initialServices,
  providers,
}: {
  initialServices: Service[];
  providers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState<Omit<Service, "id"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(data: Omit<Service, "id"> | Service) {
    setSaving(true);
    setError(null);
    const isEdit = "id" in data;
    try {
      const res = await fetch(
        isEdit ? `/api/dashboard/services/${data.id}` : "/api/dashboard/services",
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
    if (!confirm("Opravdu smazat tento typ schůzky? Historické rezervace zůstanou.")) return;
    const res = await fetch(`/api/dashboard/services/${id}`, { method: "DELETE" });
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
        <button
          className="btn-primary"
          onClick={() => setCreating({ ...emptyService })}
        >
          + Nový typ schůzky
        </button>
      </div>

      <div className="grid gap-3">
        {initialServices.map((s) => (
          <div key={s.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">
                  {s.name}{" "}
                  {!s.active && (
                    <span className="text-xs text-slate-400">(neaktivní)</span>
                  )}
                </h3>
                {s.description && (
                  <p className="text-sm text-slate-600 mt-1">{s.description}</p>
                )}
                <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-3">
                  <span>⏱ {s.durationMinutes} min</span>
                  {s.showPrice && s.priceCzk > 0 && <span>💰 {s.priceCzk} Kč</span>}
                  <span>{locationLabelEmoji(s.locationType)}</span>
                  {(s.bufferBeforeMin > 0 || s.bufferAfterMin > 0) && (
                    <span>
                      🔁 buffer {s.bufferBeforeMin}/{s.bufferAfterMin} min
                    </span>
                  )}
                  <span>
                    👥{" "}
                    {s.providerIds.length === 0
                      ? "Nikdo nenabízí"
                      : `${s.providerIds.length} osob`}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing({ ...s })}
                  className="text-sm text-brand-700 hover:underline"
                >
                  Upravit
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Smazat
                </button>
              </div>
            </div>
          </div>
        ))}
        {initialServices.length === 0 && (
          <div className="card text-center text-slate-500">
            Zatím nemáte žádné typy schůzek. Začněte tím nahoře vpravo.
          </div>
        )}
      </div>

      {(editing || creating) && (
        <ServiceForm
          initial={editing ?? creating!}
          providers={providers}
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

function locationLabelEmoji(type: string): string {
  switch (type) {
    case "in_person":
      return "📍 Osobně";
    case "online":
      return "💻 Online";
    case "phone":
      return "📞 Telefon";
    default:
      return "📌 Vlastní";
  }
}

function ServiceForm({
  initial,
  providers,
  saving,
  error,
  onCancel,
  onSave,
}: {
  initial: Service | Omit<Service, "id">;
  providers: { id: string; name: string }[];
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (s: Service | Omit<Service, "id">) => void;
}) {
  const [data, setData] = useState(initial);
  const isEdit = "id" in initial;

  function toggleProvider(id: string) {
    setData({
      ...data,
      providerIds: data.providerIds.includes(id)
        ? data.providerIds.filter((x) => x !== id)
        : [...data.providerIds, id],
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between">
          <h2 className="text-xl font-semibold">
            {isEdit ? "Upravit typ schůzky" : "Nový typ schůzky"}
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
            <label className="label">Název *</label>
            <input
              required
              className="input"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="např. Konzultace, Prohlídka, Střih…"
            />
          </div>
          <div>
            <label className="label">Popis</label>
            <textarea
              className="input"
              rows={2}
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Trvání (minuty) *</label>
              <input
                type="number"
                min={5}
                step={5}
                required
                className="input"
                value={data.durationMinutes}
                onChange={(e) =>
                  setData({ ...data, durationMinutes: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="label">Cena (Kč)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={data.priceCzk}
                onChange={(e) =>
                  setData({ ...data, priceCzk: parseInt(e.target.value) || 0 })
                }
              />
              <label className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.showPrice}
                  onChange={(e) => setData({ ...data, showPrice: e.target.checked })}
                />
                Zobrazit cenu klientovi
              </label>
            </div>
          </div>
          <div>
            <label className="label">Místo konání</label>
            <select
              className="input"
              value={data.locationType}
              onChange={(e) => setData({ ...data, locationType: e.target.value })}
            >
              <option value="in_person">📍 Osobně</option>
              <option value="online">💻 Online</option>
              <option value="phone">📞 Telefonicky</option>
              <option value="custom">📌 Vlastní</option>
            </select>
          </div>
          <div>
            <label className="label">Detail místa (adresa, Zoom link, instrukce)</label>
            <input
              className="input"
              value={data.locationDetail}
              onChange={(e) => setData({ ...data, locationDetail: e.target.value })}
              placeholder="např. Národní 25, Praha 1 nebo Zoom odkaz dorazí emailem"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rezerva před (min)</label>
              <input
                type="number"
                min={0}
                step={5}
                className="input"
                value={data.bufferBeforeMin}
                onChange={(e) =>
                  setData({ ...data, bufferBeforeMin: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="label">Rezerva po (min)</label>
              <input
                type="number"
                min={0}
                step={5}
                className="input"
                value={data.bufferAfterMin}
                onChange={(e) =>
                  setData({ ...data, bufferAfterMin: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Kdo to nabízí?</label>
            {providers.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nejdřív přidejte osoby v sekci „Tým".
              </p>
            ) : (
              <div className="space-y-1">
                {providers.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={data.providerIds.includes(p.id)}
                      onChange={() => toggleProvider(p.id)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.active}
                onChange={(e) => setData({ ...data, active: e.target.checked })}
              />
              Aktivní (zobrazí se klientům)
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

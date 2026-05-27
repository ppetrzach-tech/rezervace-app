"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { format, addMinutes } from "date-fns";
import { cs } from "date-fns/locale";
import { CopyButton } from "../../CopyButton";

type FormQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "yesno" | "select" | "number";
  required?: boolean;
  options?: string[];
};

type Slot = {
  id?: string;
  startsAt: string;
  endsAt: string;
  bookedBy?: string | null;
};

type PropertyData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  address: string;
  durationMinutes: number;
  providerId: string | null;
  active: boolean;
  formQuestions: FormQuestion[];
  slots: Slot[];
};

type Tab = "details" | "slots" | "questions";

export function PropertyEditor({
  tenantSlug,
  initial,
  providers,
}: {
  tenantSlug: string;
  initial: PropertyData;
  providers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("details");
  const [data, setData] = useState<PropertyData>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");

  // Sync slots z props když se po router.refresh() vrátí nová data ze serveru.
  // Slots se měnia jen přes server (POST/DELETE), takže neukládáme lokální editace.
  useEffect(() => {
    setData((prev) => ({ ...prev, slots: initial.slots }));
  }, [initial.slots]);

  const publicPath = `/${tenantSlug}/p/${data.slug}`;
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${publicPath}`;

  const availableSlots = data.slots.filter(
    (s) => new Date(s.startsAt).getTime() > Date.now() && !s.bookedBy,
  );

  async function saveDetails() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/dashboard/properties/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug,
          title: data.title,
          description: data.description,
          address: data.address,
          durationMinutes: data.durationMinutes,
          providerId: data.providerId,
          active: data.active,
          formQuestions: data.formQuestions,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: json.error ?? "Uložení selhalo" });
      } else {
        setMsg({ ok: true, text: "Uloženo." });
        router.refresh();
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function addSlot(dateOverride?: string, timeOverride?: string) {
    const d = dateOverride ?? newSlotDate;
    const t = timeOverride ?? newSlotTime;
    if (!d || !t) {
      setMsg({ ok: false, text: "Vyplňte datum i čas." });
      return;
    }
    const startsAt = new Date(`${d}T${t}:00`);
    if (isNaN(startsAt.getTime())) {
      setMsg({ ok: false, text: "Neplatné datum/čas." });
      return;
    }
    const endsAt = addMinutes(startsAt, data.durationMinutes);
    const res = await fetch(`/api/dashboard/properties/${data.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: j.error ?? "Nepodařilo se přidat slot" });
      return;
    }
    const json = (await res.json()) as { id: string };
    // Optimistic update — slot rovnou vidět v UI
    setData((prev) => ({
      ...prev,
      slots: [
        ...prev.slots,
        {
          id: json.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }));
    setNewSlotTime("");
    setMsg({ ok: true, text: `Slot přidán: ${format(startsAt, "d. M. HH:mm", { locale: cs })}` });
    setTimeout(() => setMsg(null), 2000);
    router.refresh();
  }

  async function deleteSlot(slotId: string) {
    if (!confirm("Smazat tento slot?")) return;
    const res = await fetch(
      `/api/dashboard/properties/${data.id}/slots/${slotId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Smazání selhalo");
      return;
    }
    // Optimistic — odebrat lokálně hned
    setData((prev) => ({
      ...prev,
      slots: prev.slots.filter((s) => s.id !== slotId),
    }));
    router.refresh();
  }

  function addQuestion() {
    setData({
      ...data,
      formQuestions: [
        ...data.formQuestions,
        {
          id: crypto.randomUUID(),
          label: "Nová otázka",
          type: "text",
          required: false,
        },
      ],
    });
  }
  function updateQuestion(id: string, patch: Partial<FormQuestion>) {
    setData({
      ...data,
      formQuestions: data.formQuestions.map((q) =>
        q.id === id ? { ...q, ...patch } : q,
      ),
    });
  }
  function removeQuestion(id: string) {
    setData({
      ...data,
      formQuestions: data.formQuestions.filter((q) => q.id !== id),
    });
  }
  function moveQuestion(id: string, dir: -1 | 1) {
    const idx = data.formQuestions.findIndex((q) => q.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= data.formQuestions.length) return;
    const arr = [...data.formQuestions];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setData({ ...data, formQuestions: arr });
  }

  return (
    <div className="space-y-6">
      {/* Hlavička */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href="/dashboard/properties"
            className="text-sm text-slate-500 hover:text-brand-700"
          >
            ← Zpět na nemovitosti
          </Link>
          <h1 className="text-3xl font-bold mt-1">{data.title || "Bez názvu"}</h1>
          <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-3">
            <span>{availableSlots.length} volných slotů</span>
            <span>•</span>
            <Link href={publicPath} target="_blank" className="text-brand-700">
              Otevřít veřejnou stránku ↗
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <CopyButton text={publicUrl} label="📋 Kopírovat odkaz" />
          <label className="text-xs flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={data.active}
              onChange={(e) => {
                setData({ ...data, active: e.target.checked });
              }}
            />
            Aktivní pro klienty
          </label>
        </div>
      </div>

      {/* Tabs */}
      <nav className="border-b border-slate-200 flex gap-1">
        <TabButton
          active={tab === "details"}
          onClick={() => setTab("details")}
          icon="📝"
          label="Detaily"
        />
        <TabButton
          active={tab === "slots"}
          onClick={() => setTab("slots")}
          icon="📅"
          label={`Termíny (${data.slots.length})`}
        />
        <TabButton
          active={tab === "questions"}
          onClick={() => setTab("questions")}
          icon="❓"
          label={`Otázky (${data.formQuestions.length})`}
        />
      </nav>

      {msg && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${
            msg.ok
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {tab === "details" && (
        <section className="card space-y-4">
          <div>
            <label className="label">Název *</label>
            <input
              className="input"
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              placeholder="např. Byt 3+kk Praha 7, Letná"
            />
          </div>
          <div>
            <label className="label">Adresa</label>
            <input
              className="input"
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              placeholder="např. Strojnická 12, Praha 7"
            />
          </div>
          <div>
            <label className="label">Popis</label>
            <textarea
              rows={4}
              className="input"
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              placeholder="Krátký popis nemovitosti, který uvidí klient…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">URL slug *</label>
              <input
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
              <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                /p/{data.slug || "vase-url"}
              </p>
            </div>
            <div>
              <label className="label">Trvání prohlídky (min) *</label>
              <input
                type="number"
                min={5}
                step={5}
                className="input"
                value={data.durationMinutes}
                onChange={(e) =>
                  setData({
                    ...data,
                    durationMinutes: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Přiřazený makléř / osoba</label>
            <select
              className="input"
              value={data.providerId ?? ""}
              onChange={(e) =>
                setData({ ...data, providerId: e.target.value || null })
              }
            >
              <option value="">— První dostupný v týmu —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <button
              onClick={saveDetails}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Ukládám…" : "Uložit detaily"}
            </button>
          </div>
        </section>
      )}

      {tab === "slots" && (
        <section className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-3">+ Přidat termín prohlídky</h3>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="label">Datum</label>
                <input
                  type="date"
                  className="input"
                  min={new Date().toISOString().slice(0, 10)}
                  value={newSlotDate}
                  onChange={(e) => setNewSlotDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Čas</label>
                <input
                  type="time"
                  step={300}
                  className="input"
                  value={newSlotTime}
                  onChange={(e) => setNewSlotTime(e.target.value)}
                />
              </div>
              <button
                onClick={() => addSlot()}
                disabled={!newSlotDate || !newSlotTime}
                className="btn-primary h-[42px]"
              >
                + Přidat
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Trvání slotu: <strong>{data.durationMinutes} min</strong> (nastaveno
              v záložce Detaily). Pro typické časy můžete použít rychlá tlačítka:
            </p>
            <div className="flex gap-1 flex-wrap mt-2">
              {["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewSlotTime(t)}
                    className={`text-xs px-2 py-1 rounded border ${
                      newSlotTime === t
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white border-slate-200 hover:border-brand-500"
                    }`}
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
          </div>

          {data.slots.length === 0 ? (
            <div className="card text-center text-slate-500 py-8">
              <div className="text-3xl mb-2">📅</div>
              Žádné termíny. Přidejte první nahoře.
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {data.slots.map((s) => {
                  const date = new Date(s.startsAt);
                  const isPast = date.getTime() < Date.now();
                  return (
                    <li
                      key={s.id}
                      className={`px-4 py-3 flex justify-between items-center ${
                        isPast ? "opacity-50" : ""
                      }`}
                    >
                      <div>
                        <div className="font-medium">
                          {format(date, "EEEE d. M. yyyy 'v' HH:mm", { locale: cs })}
                        </div>
                        {s.bookedBy ? (
                          <div className="text-xs text-brand-700">
                            ✅ {s.bookedBy}
                          </div>
                        ) : isPast ? (
                          <div className="text-xs text-slate-400">proběhlo</div>
                        ) : (
                          <div className="text-xs text-slate-500">volný</div>
                        )}
                      </div>
                      {s.id && !s.bookedBy && !isPast && (
                        <button
                          onClick={() => deleteSlot(s.id!)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Smazat
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === "questions" && (
        <section className="card space-y-4">
          <div>
            <p className="text-sm text-slate-600">
              Vlastní otázky pro klienta. Standardní otázky (jméno, email, telefon)
              jsou v formuláři vždy.
            </p>
          </div>

          <div className="space-y-3">
            {data.formQuestions.map((q, i) => (
              <div
                key={q.id}
                className="border border-slate-200 rounded-lg p-3 space-y-2"
              >
                <div className="flex gap-2 items-start">
                  <div className="flex flex-col">
                    <button
                      onClick={() => moveQuestion(q.id, -1)}
                      disabled={i === 0}
                      className="text-slate-400 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveQuestion(q.id, 1)}
                      disabled={i === data.formQuestions.length - 1}
                      className="text-slate-400 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      className="input col-span-2"
                      placeholder="Text otázky"
                      value={q.label}
                      onChange={(e) =>
                        updateQuestion(q.id, { label: e.target.value })
                      }
                    />
                    <select
                      className="input"
                      value={q.type}
                      onChange={(e) =>
                        updateQuestion(q.id, {
                          type: e.target.value as FormQuestion["type"],
                        })
                      }
                    >
                      <option value="text">Krátký text</option>
                      <option value="textarea">Delší text</option>
                      <option value="yesno">Ano / Ne</option>
                      <option value="number">Číslo</option>
                      <option value="select">Výběr z možností</option>
                    </select>
                    <label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!q.required}
                        onChange={(e) =>
                          updateQuestion(q.id, { required: e.target.checked })
                        }
                      />
                      Povinné
                    </label>
                    {q.type === "select" && (
                      <input
                        className="input col-span-2"
                        placeholder="Možnosti, oddělené čárkou"
                        value={(q.options ?? []).join(", ")}
                        onChange={(e) =>
                          updateQuestion(q.id, {
                            options: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    )}
                  </div>
                  <button
                    onClick={() => removeQuestion(q.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {data.formQuestions.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">
                Žádné vlastní otázky.
              </p>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button onClick={addQuestion} className="btn-secondary">
              + Otázka
            </button>
            <button
              onClick={saveDetails}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Ukládám…" : "Uložit otázky"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-900"
      }`}
    >
      <span className="mr-1">{icon}</span>
      {label}
    </button>
  );
}

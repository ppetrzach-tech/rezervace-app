"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { format, addMinutes } from "date-fns";
import { cs } from "date-fns/locale";

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
  const [data, setData] = useState<PropertyData>(initial);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");

  async function saveDetails() {
    setSavingDetails(true);
    setDetailsMsg(null);
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
        setDetailsMsg({ ok: false, text: json.error ?? "Uložení selhalo" });
      } else {
        setDetailsMsg({ ok: true, text: "Uloženo." });
        router.refresh();
      }
    } finally {
      setSavingDetails(false);
    }
  }

  async function addSlot() {
    if (!newSlotDate || !newSlotTime) {
      alert("Vyplňte datum i čas.");
      return;
    }
    const startsAt = new Date(`${newSlotDate}T${newSlotTime}:00`);
    if (isNaN(startsAt.getTime())) {
      alert("Neplatné datum/čas.");
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
      alert(j.error ?? "Nepodařilo se přidat slot");
      return;
    }
    setNewSlotDate("");
    setNewSlotTime("");
    router.refresh();
  }

  async function deleteSlot(slotId: string) {
    if (!confirm("Smazat tento slot?")) return;
    const res = await fetch(`/api/dashboard/properties/${data.id}/slots/${slotId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Smazání selhalo");
      return;
    }
    router.refresh();
  }

  function addQuestion() {
    setData({
      ...data,
      formQuestions: [
        ...data.formQuestions,
        { id: crypto.randomUUID(), label: "Nová otázka", type: "text", required: false },
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

  const publicUrl = `/${tenantSlug}/p/${data.slug}`;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{data.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Veřejný odkaz:{" "}
            <Link href={publicUrl} target="_blank" className="text-brand-700 font-mono">
              {publicUrl}
            </Link>
          </p>
        </div>
        <Link href="/dashboard/properties" className="text-sm text-slate-600">
          ← Zpět
        </Link>
      </div>

      {/* DETAILY */}
      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Detaily</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Název *</label>
            <input
              className="input"
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
            />
          </div>
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
          </div>
          <div>
            <label className="label">Trvání (min) *</label>
            <input
              type="number"
              min={5}
              step={5}
              className="input"
              value={data.durationMinutes}
              onChange={(e) =>
                setData({ ...data, durationMinutes: parseInt(e.target.value) || 30 })
              }
            />
          </div>
          <div className="col-span-2">
            <label className="label">Adresa</label>
            <input
              className="input"
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Popis</label>
            <textarea
              rows={3}
              className="input"
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Přiřazený realitní makléř / osoba</label>
            <select
              className="input"
              value={data.providerId ?? ""}
              onChange={(e) =>
                setData({ ...data, providerId: e.target.value || null })
              }
            >
              <option value="">(žádný)</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.active}
                onChange={(e) => setData({ ...data, active: e.target.checked })}
              />
              Aktivní (klienti uvidí stránku)
            </label>
          </div>
        </div>

        {detailsMsg && (
          <p className={`text-sm ${detailsMsg.ok ? "text-green-600" : "text-red-600"}`}>
            {detailsMsg.text}
          </p>
        )}

        <button onClick={saveDetails} disabled={savingDetails} className="btn-primary">
          {savingDetails ? "Ukládám…" : "Uložit detaily"}
        </button>
      </section>

      {/* TERMÍNY */}
      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Termíny prohlídek</h2>
        <p className="text-sm text-slate-600">
          Ručně přidejte konkrétní časy, kdy je byt na prohlídku. Klient si vybere
          jeden z nich. Trvání slotu = {data.durationMinutes} min.
        </p>

        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="label">Datum</label>
            <input
              type="date"
              className="input"
              value={newSlotDate}
              onChange={(e) => setNewSlotDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Čas (HH:MM)</label>
            <input
              type="time"
              className="input"
              value={newSlotTime}
              onChange={(e) => setNewSlotTime(e.target.value)}
            />
          </div>
          <button onClick={addSlot} className="btn-primary">
            + Přidat termín
          </button>
        </div>

        <div className="space-y-2">
          {data.slots.length === 0 && (
            <p className="text-slate-500 text-sm">Zatím žádné termíny.</p>
          )}
          {data.slots.map((s) => {
            const date = new Date(s.startsAt);
            const isPast = date.getTime() < Date.now();
            return (
              <div
                key={s.id}
                className={`flex justify-between items-center p-3 rounded-lg border ${
                  isPast ? "border-slate-100 text-slate-400" : "border-slate-200"
                }`}
              >
                <div>
                  <div className="font-medium">
                    {format(date, "EEEE d. M. yyyy 'v' HH:mm", { locale: cs })}
                  </div>
                  {s.bookedBy ? (
                    <div className="text-xs text-brand-700">
                      ✅ Rezervováno: {s.bookedBy}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Volný slot</div>
                  )}
                </div>
                {s.id && !s.bookedBy && (
                  <button
                    onClick={() => deleteSlot(s.id!)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Smazat
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* OTÁZKY */}
      <section className="card space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Otázky ve formuláři</h2>
            <p className="text-sm text-slate-600">
              Co se má klienta zeptat při rezervaci. Standardní otázky (jméno,
              email, telefon) jsou vždy v formuláři — sem přidávejte navíc to, co
              potřebujete.
            </p>
          </div>
          <button onClick={addQuestion} className="btn-secondary">
            + Otázka
          </button>
        </div>

        <div className="space-y-3">
          {data.formQuestions.map((q, i) => (
            <div key={q.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex gap-2 items-start">
                <div className="flex flex-col">
                  <button
                    onClick={() => moveQuestion(q.id, -1)}
                    disabled={i === 0}
                    className="text-slate-400 disabled:opacity-30"
                    title="Nahoru"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveQuestion(q.id, 1)}
                    disabled={i === data.formQuestions.length - 1}
                    className="text-slate-400 disabled:opacity-30"
                    title="Dolů"
                  >
                    ↓
                  </button>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    className="input col-span-2"
                    placeholder="Text otázky"
                    value={q.label}
                    onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                  />
                  <select
                    className="input"
                    value={q.type}
                    onChange={(e) =>
                      updateQuestion(q.id, { type: e.target.value as FormQuestion["type"] })
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
                      placeholder="Možnosti, oddělené čárkou (např. Ano, Ne, Možná)"
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
            <p className="text-slate-500 text-sm">
              Žádné vlastní otázky. Klikněte „+ Otázka" výše.
            </p>
          )}
        </div>

        <button onClick={saveDetails} disabled={savingDetails} className="btn-primary">
          {savingDetails ? "Ukládám…" : "Uložit otázky"}
        </button>
      </section>
    </div>
  );
}

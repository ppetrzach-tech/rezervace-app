"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addMinutes } from "date-fns";
import { czDayMonthTime } from "@/lib/datetime";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  bookedBy: string | null;
};
type FormQuestion = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};
type Provider = { id: string; name: string };
type Data = {
  id: string;
  slug: string;
  title: string;
  emailName: string;
  description: string;
  address: string;
  durationMinutes: number;
  providerId: string | null;
  active: boolean;
  formQuestions: FormQuestion[];
  slots: Slot[];
};

export function ConsultationEditor({
  tenantSlug,
  providers,
  initial,
}: {
  tenantSlug: string;
  providers: Provider[];
  initial: Data;
}) {
  const router = useRouter();
  const [data, setData] = useState<Data>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");

  const publicPath = `/${tenantSlug}/p/${data.slug}`;
  const upcoming = data.slots.filter(
    (s) => new Date(s.startsAt).getTime() >= Date.now(),
  );
  const past = data.slots.filter(
    (s) => new Date(s.startsAt).getTime() < Date.now(),
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
          emailName: data.emailName,
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

  async function addSlot() {
    if (!newSlotDate || !newSlotTime) {
      setMsg({ ok: false, text: "Vyplňte datum i čas." });
      return;
    }
    const startsAt = new Date(`${newSlotDate}T${newSlotTime}:00`);
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
      setMsg({ ok: false, text: j.error ?? "Nepodařilo se přidat termín" });
      return;
    }
    const json = (await res.json()) as { id: string };
    setData((prev) => ({
      ...prev,
      slots: [
        ...prev.slots,
        {
          id: json.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          bookedBy: null,
        },
      ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }));
    setNewSlotTime("");
    setMsg({ ok: true, text: `Termín přidán: ${czDayMonthTime(startsAt)}` });
    setTimeout(() => setMsg(null), 2000);
  }

  async function deleteSlot(slotId: string) {
    if (!confirm("Smazat tento termín?")) return;
    const res = await fetch(
      `/api/dashboard/properties/${data.id}/slots/${slotId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Smazání selhalo");
      return;
    }
    setData((prev) => ({
      ...prev,
      slots: prev.slots.filter((s) => s.id !== slotId),
    }));
  }

  function copyLink() {
    const url = `${window.location.origin}${publicPath}`;
    navigator.clipboard?.writeText(url);
    setMsg({ ok: true, text: "Odkaz zkopírován." });
    setTimeout(() => setMsg(null), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/dashboard/consultations"
          className="text-sm text-slate-500 hover:text-brand-700"
        >
          ← Zpět na konzultace
        </Link>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <h1 className="text-3xl font-bold">{data.title || "Konzultace"}</h1>
          {data.active ? (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              aktivní
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
              neaktivní
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
          <code className="bg-slate-100 px-2 py-1 rounded text-slate-600 truncate">
            {publicPath}
          </code>
          <button onClick={copyLink} className="btn-secondary text-xs">
            📋 Kopírovat odkaz
          </button>
          <Link
            href={publicPath}
            target="_blank"
            className="btn-secondary text-xs"
          >
            ↗ Otevřít
          </Link>
        </div>
      </div>

      {msg && (
        <div
          className={`text-sm px-3 py-2 rounded-lg ${
            msg.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Detaily */}
      <section className="card space-y-4">
        <h2 className="font-semibold">Detaily</h2>
        <div>
          <label className="label">Název *</label>
          <input
            className="input"
            value={data.title}
            onChange={(e) => setData({ ...data, title: e.target.value })}
            placeholder="např. Úvodní konzultace"
          />
        </div>
        <div>
          <label className="label">Název v e‑mailech (nepovinné)</label>
          <input
            className="input"
            value={data.emailName}
            onChange={(e) => setData({ ...data, emailName: e.target.value })}
            placeholder="např. úvodní konzultace"
          />
          <p className="text-xs text-slate-500 mt-1">
            Krátký tvar do vět v e‑mailech. Když necháte prázdné, použije se
            „Název" výše.
          </p>
        </div>
        <div>
          <label className="label">Místo konání</label>
          <input
            className="input"
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            placeholder="např. Online (Google Meet) nebo kancelář Přerov"
          />
        </div>
        <div>
          <label className="label">Popis</label>
          <textarea
            className="input"
            rows={3}
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
            placeholder="Krátký popis, který klient uvidí…"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Délka konzultace (min) *</label>
            <input
              type="number"
              min={5}
              step={5}
              className="input w-32"
              value={data.durationMinutes}
              onChange={(e) =>
                setData({
                  ...data,
                  durationMinutes: parseInt(e.target.value) || 30,
                })
              }
            />
          </div>
          {providers.length > 0 && (
            <div>
              <label className="label">Osoba</label>
              <select
                className="input"
                value={data.providerId ?? ""}
                onChange={(e) =>
                  setData({ ...data, providerId: e.target.value || null })
                }
              >
                <option value="">— (výchozí)</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.active}
            onChange={(e) => setData({ ...data, active: e.target.checked })}
          />
          Aktivní (zobrazuje se klientům)
        </label>

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

      {/* Termíny */}
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">Termíny</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ruční konkrétní termíny, na které se klient přihlásí. Přidejte klidně
            jen jeden dva.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-end">
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
            <label className="label">Čas</label>
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

        {upcoming.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg">
            Zatím žádné nadcházející termíny.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100"
              >
                <span className="text-sm font-medium">
                  {czDayMonthTime(new Date(s.startsAt))}
                </span>
                {s.bookedBy ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">
                    rezervováno: {s.bookedBy}
                  </span>
                ) : (
                  <button
                    onClick={() => deleteSlot(s.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Smazat
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500">
              Proběhlé termíny ({past.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {past.map((s) => (
                <li key={s.id} className="text-slate-400 px-3 py-1">
                  {czDayMonthTime(new Date(s.startsAt))}
                  {s.bookedBy ? ` · ${s.bookedBy}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

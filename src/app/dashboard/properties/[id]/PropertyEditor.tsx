"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addMinutes } from "date-fns";
import { czDateTimeLong, czDayMonthTime } from "@/lib/datetime";
import { CopyButton } from "../../CopyButton";
import { ShareButton } from "../../ShareModal";
import { DuplicateButton } from "../DuplicateButton";

type QuestionType =
  | "text"
  | "textarea"
  | "yesno"
  | "number"
  | "select"
  | "rating"
  | "date"
  | "phone";

type FormQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

const QUESTION_TYPES: {
  type: QuestionType;
  label: string;
  icon: string;
  color: string;
  description: string;
}[] = [
  { type: "text", label: "Krátký text", icon: "📝", color: "blue", description: "Jednořádkový text" },
  { type: "textarea", label: "Delší text", icon: "📄", color: "indigo", description: "Víceřádkový text" },
  { type: "yesno", label: "Ano / Ne", icon: "✅", color: "green", description: "Tlačítka Ano nebo Ne" },
  { type: "number", label: "Číslo", icon: "🔢", color: "amber", description: "Číselný vstup" },
  { type: "select", label: "Výběr možností", icon: "📋", color: "purple", description: "Vyberte z předpřipravených možností" },
  { type: "rating", label: "Hvězdičky 1–5", icon: "⭐", color: "orange", description: "Hodnocení od 1 do 5 hvězd" },
  { type: "date", label: "Datum", icon: "📅", color: "pink", description: "Výběr data v kalendáři" },
  { type: "phone", label: "Telefon", icon: "📞", color: "teal", description: "Tel. číslo s prefixem" },
];

const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string; ring: string }> = {
  blue: { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-500" },
  indigo: { border: "border-indigo-300", bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-500" },
  green: { border: "border-green-300", bg: "bg-green-50", text: "text-green-700", ring: "ring-green-500" },
  amber: { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-500" },
  purple: { border: "border-purple-300", bg: "bg-purple-50", text: "text-purple-700", ring: "ring-purple-500" },
  orange: { border: "border-orange-300", bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-500" },
  pink: { border: "border-pink-300", bg: "bg-pink-50", text: "text-pink-700", ring: "ring-pink-500" },
  teal: { border: "border-teal-300", bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-500" },
};

function typeMeta(type: string) {
  return QUESTION_TYPES.find((t) => t.type === type) ?? QUESTION_TYPES[0];
}

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
  imageUrl: string;
  documentsUrl: string;
  virtualTourUrl: string;
  propertyWebUrl: string;
  offerFormUrl: string;
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
          imageUrl: data.imageUrl,
          documentsUrl: data.documentsUrl,
          virtualTourUrl: data.virtualTourUrl,
          propertyWebUrl: data.propertyWebUrl,
          offerFormUrl: data.offerFormUrl,
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
    setMsg({ ok: true, text: `Slot přidán: ${czDayMonthTime(startsAt)}` });
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
          <div className="flex gap-2">
            <DuplicateButton propertyId={data.id} label="⧉ Duplikovat" />
            <CopyButton text={publicUrl} label="📋 Kopírovat" />
            <ShareButton url={publicUrl} label="📱 QR kód" title={`Sdílení: ${data.title}`} />
          </div>
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
            <p className="text-xs text-slate-500 mt-1">
              Adresa se automaticky propojí s odkazem do Mapy.cz a Google Maps.
            </p>
          </div>
          <div>
            <label className="label">📸 Hlavní fotka (URL)</label>
            <input
              className="input"
              type="url"
              placeholder="https://… (odkaz na obrázek)"
              value={data.imageUrl}
              onChange={(e) => setData({ ...data, imageUrl: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">
              Nahrajte foto na Google Drive, Imgur nebo cokoliv jiného a sem
              vložte přímý odkaz. Tip: na{" "}
              <a
                href="https://imgur.com/upload"
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 hover:underline"
              >
                imgur.com/upload
              </a>{" "}
              přetáhněte foto, pravým klikem zkopírujte adresu obrázku.
            </p>
            {data.imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.imageUrl}
                  alt=""
                  className="w-full max-h-64 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
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

          {/* Sekce: Odkazy */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span>🔗</span>
              <span>Odkazy pro emailové šablony</span>
            </h3>
            <p className="text-xs text-slate-500">
              Tyto URL se dosadí do emailů odeslaných klientům. Vyplňte ty,
              které pro tuto nemovitost používáte.
            </p>

            <div>
              <label className="label text-xs">
                📂 Google Drive / dokumenty
              </label>
              <input
                type="url"
                className="input"
                placeholder="https://drive.google.com/…"
                value={data.documentsUrl}
                onChange={(e) =>
                  setData({ ...data, documentsUrl: e.target.value })
                }
              />
              <p className="text-xs text-slate-400 mt-1">
                V emailu jako proměnná{" "}
                <code>{"{{documents_url}}"}</code>
              </p>
            </div>

            <div>
              <label className="label text-xs">🎥 Virtuální prohlídka</label>
              <input
                type="url"
                className="input"
                placeholder="https://…"
                value={data.virtualTourUrl}
                onChange={(e) =>
                  setData({ ...data, virtualTourUrl: e.target.value })
                }
              />
              <p className="text-xs text-slate-400 mt-1">
                V emailu jako <code>{"{{virtual_tour_url}}"}</code>
              </p>
            </div>

            <div>
              <label className="label text-xs">🌐 Inzerát na webu</label>
              <input
                type="url"
                className="input"
                placeholder="https://www.sreality.cz/…"
                value={data.propertyWebUrl}
                onChange={(e) =>
                  setData({ ...data, propertyWebUrl: e.target.value })
                }
              />
              <p className="text-xs text-slate-400 mt-1">
                V emailu jako <code>{"{{property_web_url}}"}</code>
              </p>
            </div>

            <div>
              <label className="label text-xs">
                📝 Nabídkový formulář (po prohlídce)
              </label>
              <input
                type="url"
                className="input"
                placeholder="https://forms.google.com/…"
                value={data.offerFormUrl}
                onChange={(e) =>
                  setData({ ...data, offerFormUrl: e.target.value })
                }
              />
              <p className="text-xs text-slate-400 mt-1">
                V emailu jako <code>{"{{offer_form_url}}"}</code>
              </p>
            </div>
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
                          {czDateTimeLong(date)}
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
        <section className="space-y-4">
          <div className="card bg-gradient-to-br from-brand-50 to-white border-brand-200">
            <p className="text-sm text-slate-700">
              ✨ Vlastní otázky pro klienta. Standardní otázky (jméno, email,
              telefon) jsou v formuláři vždy automaticky.
            </p>
          </div>

          {data.formQuestions.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-5xl mb-3">📝</div>
              <p className="text-slate-500 mb-4">
                Zatím žádné otázky. Přidejte první.
              </p>
              <button onClick={addQuestion} className="btn-primary">
                + Přidat otázku
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.formQuestions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  total={data.formQuestions.length}
                  onUpdate={(patch) => updateQuestion(q.id, patch)}
                  onRemove={() => removeQuestion(q.id)}
                  onMove={(dir) => moveQuestion(q.id, dir)}
                />
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            {data.formQuestions.length > 0 && (
              <button onClick={addQuestion} className="btn-secondary">
                + Další otázka
              </button>
            )}
            <button
              onClick={saveDetails}
              disabled={saving}
              className="btn-primary ml-auto"
            >
              {saving ? "Ukládám…" : "💾 Uložit otázky"}
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

// === Question editor ===========================================================

function QuestionCard({
  question,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  question: FormQuestion;
  index: number;
  total: number;
  onUpdate: (patch: Partial<FormQuestion>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const meta = typeMeta(question.type);
  const c = COLOR_CLASSES[meta.color];

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-l-4 ${c.border} border-r border-t border-b border-slate-200 overflow-hidden`}
    >
      {/* Hlavička */}
      <div
        className={`px-4 py-2 flex items-center justify-between ${c.bg} border-b border-slate-100`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <span className={`text-xs font-semibold uppercase ${c.text}`}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="text-slate-400 disabled:opacity-30 hover:text-slate-700 px-1"
            title="Posunout nahoru"
          >
            ↑
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="text-slate-400 disabled:opacity-30 hover:text-slate-700 px-1"
            title="Posunout dolů"
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 px-1 ml-2"
            title="Smazat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Obsah */}
      <div className="p-4 space-y-4">
        {/* Otázka */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
            Otázka
          </label>
          <input
            className="w-full text-base font-medium border-0 border-b border-slate-200 px-0 py-1 focus:outline-none focus:border-brand-500 bg-transparent"
            placeholder="Napište otázku…"
            value={question.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </div>

        {/* Typ — pills */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2 uppercase">
            Typ odpovědi
          </label>
          <div className="flex flex-wrap gap-1.5">
            {QUESTION_TYPES.map((t) => {
              const tc = COLOR_CLASSES[t.color];
              const selected = question.type === t.type;
              return (
                <button
                  key={t.type}
                  onClick={() => onUpdate({ type: t.type })}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    selected
                      ? `${tc.bg} ${tc.text} ring-2 ${tc.ring}`
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                  title={t.description}
                >
                  <span className="mr-1">{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <ToggleSwitch
            label="Povinná otázka"
            checked={!!question.required}
            onChange={(v) => onUpdate({ required: v })}
          />
        </div>

        {/* Type-specific extras */}
        {question.type === "select" && (
          <OptionsEditor
            options={question.options ?? []}
            onChange={(options) => onUpdate({ options })}
            color={meta.color}
          />
        )}

        {/* Live preview */}
        <details className="bg-slate-50 rounded-lg border border-slate-100 p-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 uppercase">
            👁 Náhled jak to klient uvidí
          </summary>
          <div className="mt-3 pt-3 border-t border-slate-200">
            <QuestionPreview question={question} />
          </div>
        </details>
      </div>
    </div>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
          checked ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-slate-700">{label}</span>
    </label>
  );
}

function OptionsEditor({
  options,
  onChange,
  color,
}: {
  options: string[];
  onChange: (next: string[]) => void;
  color: string;
}) {
  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.purple;

  function update(i: number, value: string) {
    onChange(options.map((o, idx) => (idx === i ? value : o)));
  }
  function remove(i: number) {
    onChange(options.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...options, ""]);
  }
  function move(i: number, dir: -1 | 1) {
    const next = [...options];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-500 uppercase">
        Možnosti k výběru
      </div>
      {options.length === 0 && (
        <p className="text-xs text-slate-400 italic py-1">
          Zatím žádná možnost — přidejte první níže.
        </p>
      )}
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`text-xs font-mono w-6 text-center ${c.text}`}>
              {i + 1}.
            </span>
            <input
              className="flex-1 px-3 py-1.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder={`Možnost ${i + 1}`}
              value={opt}
              onChange={(e) => update(i, e.target.value)}
              autoFocus={i === options.length - 1 && opt === ""}
            />
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="text-slate-400 disabled:opacity-30 hover:text-slate-700"
              title="Nahoru"
            >
              ↑
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === options.length - 1}
              className="text-slate-400 disabled:opacity-30 hover:text-slate-700"
              title="Dolů"
            >
              ↓
            </button>
            <button
              onClick={() => remove(i)}
              className="text-red-500 hover:text-red-700 px-1"
              title="Smazat"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className={`text-sm font-medium px-3 py-1.5 rounded-md ${c.bg} ${c.text} hover:opacity-80`}
      >
        + Přidat možnost
      </button>
    </div>
  );
}

function QuestionPreview({ question }: { question: FormQuestion }) {
  const label = question.label || "(text otázky)";
  const req = question.required ? " *" : "";
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {req}
      </label>
      {question.type === "text" && (
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Sem klient napíše odpověď"
          disabled
        />
      )}
      {question.type === "textarea" && (
        <textarea
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Sem klient napíše delší odpověď"
          disabled
        />
      )}
      {question.type === "yesno" && (
        <div className="flex gap-2">
          <button
            disabled
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            ✓ Ano
          </button>
          <button
            disabled
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            ✗ Ne
          </button>
        </div>
      )}
      {question.type === "number" && (
        <input
          type="number"
          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="0"
          disabled
        />
      )}
      {question.type === "select" && (
        <div className="flex flex-wrap gap-1.5">
          {(question.options ?? []).length === 0 ? (
            <span className="text-xs text-slate-400 italic">
              (zatím bez možností)
            </span>
          ) : (
            (question.options ?? []).map((o, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-sm border border-purple-200"
              >
                {o}
              </span>
            ))
          )}
        </div>
      )}
      {question.type === "rating" && (
        <div className="flex gap-1 text-2xl">
          <span className="text-slate-300">★</span>
          <span className="text-slate-300">★</span>
          <span className="text-slate-300">★</span>
          <span className="text-slate-300">★</span>
          <span className="text-slate-300">★</span>
        </div>
      )}
      {question.type === "date" && (
        <input
          type="date"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled
        />
      )}
      {question.type === "phone" && (
        <input
          type="tel"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="+420 ___ ___ ___"
          disabled
        />
      )}
    </div>
  );
}

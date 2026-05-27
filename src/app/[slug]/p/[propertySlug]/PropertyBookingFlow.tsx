"use client";

import { useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

type FormQuestion = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

type Listing = {
  id: string;
  title: string;
  address: string | null;
  durationMinutes: number;
  formQuestions: FormQuestion[];
};

type Slot = { id: string; startsAt: string; endsAt: string };

export function PropertyBookingFlow({
  tenantSlug,
  listing,
  slots,
}: {
  tenantSlug: string;
  listing: Listing;
  slots: Slot[];
}) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    note: "",
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    bookingId: string;
    emailSent: boolean;
  } | null>(null);

  // Seskupíme sloty po dnech
  const byDay: Record<string, Slot[]> = {};
  for (const s of slots) {
    const day = format(new Date(s.startsAt), "yyyy-MM-dd");
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(s);
  }
  const days = Object.keys(byDay).sort();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${listing.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          slotId: selectedSlot.id,
          client: form,
          answers: listing.formQuestions.map((q) => ({
            id: q.id,
            label: q.label,
            value: answers[q.id] ?? "",
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Něco se nepovedlo");
        return;
      }
      setDone({ bookingId: json.bookingId, emailSent: json.emailSent ?? false });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-2xl font-semibold mb-2">Rezervace potvrzena</h2>
        <p className="text-slate-600 mb-1">
          <strong>{listing.title}</strong>
        </p>
        {selectedSlot && (
          <p className="text-slate-600 mb-4">
            {format(new Date(selectedSlot.startsAt), "EEEE d. M. yyyy 'v' HH:mm", {
              locale: cs,
            })}
          </p>
        )}
        <p className="text-sm text-slate-500">
          {done.emailSent
            ? "📧 Potvrzovací email byl odeslán. Bude obsahovat i .ics soubor pro váš kalendář."
            : "📧 Email nebyl odeslán (Resend nenakonfigurován)."}
        </p>
        <p className="text-xs text-slate-400 mt-4">Číslo: {done.bookingId}</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="card text-center text-slate-500">
        Momentálně nejsou volné termíny. Zkuste to později, nebo nás kontaktujte.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SLOT SELECTION */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-1">Vyberte termín prohlídky</h2>
        <p className="text-sm text-slate-600 mb-4">
          Trvání: {listing.durationMinutes} min
        </p>
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day}>
              <div className="text-sm font-medium text-slate-600 mb-2">
                {format(new Date(day), "EEEE d. MMMM yyyy", { locale: cs })}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {byDay[day].map((s) => {
                  const selected = selectedSlot?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSlot(s)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                        selected
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-white border-slate-200 hover:border-brand-500 hover:bg-brand-50"
                      }`}
                    >
                      {format(new Date(s.startsAt), "HH:mm")}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FORM */}
      {selectedSlot && (
        <form onSubmit={submit} className="card space-y-4">
          <h2 className="text-xl font-semibold">Vaše údaje</h2>
          <p className="text-sm text-slate-600 -mt-2">
            Vybrán termín:{" "}
            <strong>
              {format(new Date(selectedSlot.startsAt), "EEEE d. M. yyyy 'v' HH:mm", {
                locale: cs,
              })}
            </strong>
          </p>

          <div>
            <label className="label">Jméno a příjmení *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              required
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Telefon *</label>
            <input
              required
              type="tel"
              placeholder="+420…"
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          {listing.formQuestions.map((q) => (
            <div key={q.id}>
              <label className="label">
                {q.label} {q.required && "*"}
              </label>
              {q.type === "textarea" ? (
                <textarea
                  required={q.required}
                  rows={3}
                  className="input"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                />
              ) : q.type === "yesno" ? (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      required={q.required}
                      name={`q-${q.id}`}
                      checked={answers[q.id] === "Ano"}
                      onChange={() => setAnswers({ ...answers, [q.id]: "Ano" })}
                    />{" "}
                    Ano
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      required={q.required}
                      name={`q-${q.id}`}
                      checked={answers[q.id] === "Ne"}
                      onChange={() => setAnswers({ ...answers, [q.id]: "Ne" })}
                    />{" "}
                    Ne
                  </label>
                </div>
              ) : q.type === "select" ? (
                <select
                  required={q.required}
                  className="input"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                >
                  <option value="">— Vyberte —</option>
                  {(q.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : q.type === "number" ? (
                <input
                  type="number"
                  required={q.required}
                  className="input"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                />
              ) : (
                <input
                  type="text"
                  required={q.required}
                  className="input"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                />
              )}
            </div>
          ))}

          <div>
            <label className="label">Poznámka (volitelná)</label>
            <textarea
              rows={2}
              className="input"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Odesílám…" : "Potvrdit rezervaci"}
          </button>
        </form>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

type FormQuestion = {
  id: string;
  label: string;
  type: string; // "text" | "textarea" | "yesno" | "select" | "number" | "rating" | "date" | "phone"
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
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id] ?? ""}
              onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
            />
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

// ============================================================================
// Question field — vykreslí jakýkoliv typ otázky z formuláře
// ============================================================================

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">
        {question.label} {question.required && <span className="text-red-500">*</span>}
      </label>
      <QuestionInput question={question} value={value} onChange={onChange} />
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const required = !!question.required;

  if (question.type === "textarea") {
    return (
      <textarea
        required={required}
        rows={3}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (question.type === "yesno") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange("Ano")}
          className={`flex-1 px-4 py-2.5 rounded-lg border font-medium transition ${
            value === "Ano"
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-slate-700 border-slate-200 hover:border-green-500"
          }`}
        >
          ✓ Ano
        </button>
        <button
          type="button"
          onClick={() => onChange("Ne")}
          className={`flex-1 px-4 py-2.5 rounded-lg border font-medium transition ${
            value === "Ne"
              ? "bg-red-500 text-white border-red-500"
              : "bg-white text-slate-700 border-slate-200 hover:border-red-400"
          }`}
        >
          ✗ Ne
        </button>
        {required && !value && (
          <input
            type="text"
            required
            tabIndex={-1}
            className="sr-only"
            value={value}
            onChange={() => {}}
          />
        )}
      </div>
    );
  }

  if (question.type === "select") {
    const opts = question.options ?? [];
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const selected = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                selected
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-brand-500"
              }`}
            >
              {o}
            </button>
          );
        })}
        {required && !value && (
          <input
            type="text"
            required
            tabIndex={-1}
            className="sr-only"
            value={value}
            onChange={() => {}}
          />
        )}
      </div>
    );
  }

  if (question.type === "number") {
    return (
      <input
        type="number"
        required={required}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (question.type === "rating") {
    const numValue = parseInt(value) || 0;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(String(star))}
            className={`text-3xl transition ${
              star <= numValue
                ? "text-yellow-400 hover:text-yellow-500"
                : "text-slate-300 hover:text-yellow-300"
            }`}
            aria-label={`${star} z 5`}
          >
            ★
          </button>
        ))}
        {numValue > 0 && (
          <span className="ml-2 self-center text-sm text-slate-600">
            {numValue}/5
          </span>
        )}
        {required && !value && (
          <input
            type="text"
            required
            tabIndex={-1}
            className="sr-only"
            value={value}
            onChange={() => {}}
          />
        )}
      </div>
    );
  }

  if (question.type === "date") {
    return (
      <input
        type="date"
        required={required}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (question.type === "phone") {
    return (
      <input
        type="tel"
        required={required}
        className="input"
        placeholder="+420 ___ ___ ___"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // default: text
  return (
    <input
      type="text"
      required={required}
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

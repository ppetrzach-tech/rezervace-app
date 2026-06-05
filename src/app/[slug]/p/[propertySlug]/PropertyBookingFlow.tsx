"use client";

import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  startOfWeek,
  addDays,
  isBefore,
  startOfDay,
} from "date-fns";
import { czDateTimeLong, czTime, czWeekdayDayMonth } from "@/lib/datetime";
import { t as createT, type Locale as AppLocale } from "@/lib/i18n";

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

type Step = "date" | "form" | "done";

export function PropertyBookingFlow({
  tenantSlug,
  tenantName,
  locale = "cs",
  listing,
  slots,
}: {
  tenantSlug: string;
  tenantName: string;
  locale?: AppLocale;
  listing: Listing;
  slots: Slot[];
}) {
  const tr = createT(locale);
  const [step, setStep] = useState<Step>("date");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    slots.length > 0 ? startOfMonth(new Date(slots[0].startsAt)) : startOfMonth(new Date()),
  );
  const [selectedDay, setSelectedDay] = useState<Date | null>(
    slots.length > 0 ? startOfDay(new Date(slots[0].startsAt)) : null,
  );
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

  // Map slots by date
  const slotsByDay = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of slots) {
      const key = format(new Date(s.startsAt), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [slots]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(addDays(start, i));
    }
    return days;
  }, [currentMonth]);

  const today = startOfDay(new Date());

  // Slots na vybraný den
  const daySlots = selectedDay
    ? slotsByDay[format(selectedDay, "yyyy-MM-dd")] ?? []
    : [];

  async function submitBooking() {
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
      setStep("done");
    } finally {
      setSubmitting(false);
    }
  }

  // No slots at all
  if (slots.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="text-5xl mb-3">😔</div>
        <h2 className="text-xl font-semibold mb-2">{tr("noslots.title")}</h2>
        <p className="text-slate-600">{tr("noslots.body")}</p>
      </div>
    );
  }

  // Done state
  if (step === "done" && done && selectedSlot) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-8 text-center">
          <div className="text-6xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold mb-2">{tr("done.title")}</h2>
          <p className="opacity-90">{tr("done.subtitle")}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <div className="text-xs font-medium text-slate-500 uppercase mb-1">
              {tr("done.your_viewing")}
            </div>
            <div className="font-semibold text-lg">{listing.title}</div>
            <div className="text-slate-600 mt-1">
              📅{" "}
              {czDateTimeLong(new Date(selectedSlot.startsAt))}
            </div>
            {listing.address && (
              <div className="text-slate-600 mt-1">📍 {listing.address}</div>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="text-green-600">✓</span>
              <span>
                {done.emailSent
                  ? `${tr("done.email_sent")} ${form.email}`
                  : tr("done.email_no")}
              </span>
            </div>
            {done.emailSent && (
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-green-600">✓</span>
                <span>{tr("done.ics")}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-700">
              <span className="text-green-600">✓</span>
              <span>
                {tenantName} {tr("done.aware")}
              </span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            💡 <strong>Tip:</strong> {tr("done.tip")}
          </div>

          <p className="text-xs text-slate-400 text-center pt-2">
            {tr("done.booking_nr")} {done.bookingId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <Stepper
        current={step}
        labels={{
          date: tr("step.date"),
          form: tr("step.form"),
          done: tr("step.done"),
        }}
      />

      {/* Step: Date selection */}
      {step === "date" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <span>📅</span>
                <span>{tr("calendar.title")}</span>
              </h2>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
                aria-label={tr("calendar.prev")}
              >
                ←
              </button>
              <h3 className="font-semibold capitalize">
                {currentMonth.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague", month: "long", year: "numeric" })}
              </h3>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
                aria-label={tr("calendar.next")}
              >
                →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-slate-500 uppercase">
              {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const hasSlots = !!slotsByDay[dayKey];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isPast = isBefore(day, today);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const isToday = isSameDay(day, today);

                const disabled = isPast || !hasSlots;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      if (!disabled) setSelectedDay(day);
                    }}
                    disabled={disabled}
                    className={`
                      aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative
                      ${!isCurrentMonth ? "opacity-30" : ""}
                      ${
                        isSelected
                          ? "bg-brand-600 text-white font-bold shadow-md"
                          : hasSlots && !isPast
                            ? "bg-brand-50 text-brand-900 hover:bg-brand-100 cursor-pointer font-medium"
                            : "text-slate-400 cursor-not-allowed"
                      }
                      ${isToday && !isSelected ? "ring-2 ring-brand-500 ring-inset" : ""}
                      transition
                    `}
                  >
                    <span>{format(day, "d")}</span>
                    {hasSlots && !isSelected && !isPast && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          <div className="p-5">
            {!selectedDay ? (
              <p className="text-center text-slate-500 py-6">
                {tr("calendar.pick_day")}
              </p>
            ) : daySlots.length === 0 ? (
              <p className="text-center text-slate-500 py-6">
                {tr("calendar.no_times")}
              </p>
            ) : (
              <>
                <div className="text-sm font-medium text-slate-700 mb-3">
                  {tr("calendar.free_times")}:{" "}
                  <span className="text-slate-500 font-normal">
                    {czWeekdayDayMonth(selectedDay)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {daySlots.map((slot) => {
                    const selected = selectedSlot?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep("form");
                        }}
                        className={`
                          px-3 py-3 rounded-lg border text-sm font-semibold transition
                          ${
                            selected
                              ? "bg-brand-600 text-white border-brand-600"
                              : "bg-white border-slate-200 hover:border-brand-500 hover:bg-brand-50 hover:shadow"
                          }
                        `}
                      >
                        {czTime(new Date(slot.startsAt))}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step: Form */}
      {step === "form" && selectedSlot && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Selected slot summary */}
          <div className="bg-gradient-to-br from-brand-50 to-brand-100 border-b border-brand-200 px-5 py-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-brand-900">
                <span className="text-2xl">✓</span>
                <div>
                  <div className="text-xs uppercase font-medium opacity-70">
                    {tr("form.selected_term")}
                  </div>
                  <div className="font-semibold">
                    {czDateTimeLong(new Date(selectedSlot.startsAt))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep("date")}
                className="text-sm text-brand-700 hover:underline"
              >
                {tr("form.change")}
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitBooking();
            }}
            className="p-5 space-y-5"
          >
            <h2 className="font-semibold flex items-center gap-2">
              <span>📝</span>
              <span>{tr("form.title")}</span>
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{tr("form.name")} *</label>
                <input
                  required
                  className="input"
                  placeholder={tr("form.name_ph")}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{tr("form.phone")} *</label>
                <input
                  required
                  type="tel"
                  className="input"
                  placeholder={tr("form.phone_ph")}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label">{tr("form.email")} *</label>
              <input
                required
                type="email"
                className="input"
                placeholder={tr("form.email_ph")}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            {listing.formQuestions.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">
                  {tr("form.extra_info")}
                </h3>
                {listing.formQuestions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    value={answers[q.id] ?? ""}
                    onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                  />
                ))}
              </div>
            )}

            <div>
              <label className="label">{tr("form.note")}</label>
              <textarea
                rows={2}
                className="input"
                placeholder={tr("form.note_ph")}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep("date")}
                className="btn-secondary"
              >
                {tr("form.back")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex-1 justify-center text-base"
              >
                {submitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    {tr("form.submitting")}
                  </>
                ) : (
                  <>{tr("form.submit")}</>
                )}
              </button>
            </div>

            <p className="text-xs text-center text-slate-400">
              {tr("form.gdpr")}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

function Stepper({
  current,
  labels,
}: {
  current: Step;
  labels: { date: string; form: string; done: string };
}) {
  const steps = [
    { id: "date" as const, label: labels.date, icon: "📅" },
    { id: "form" as const, label: labels.form, icon: "📝" },
    { id: "done" as const, label: labels.done, icon: "✓" },
  ];
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-1 sm:gap-2 bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : done
                    ? "text-green-700"
                    : "text-slate-400"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  active
                    ? "bg-brand-600 text-white"
                    : done
                      ? "bg-green-500 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="text-sm font-medium hidden sm:inline">
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="text-slate-300 hidden sm:inline">→</span>
            )}
          </li>
        );
      })}
    </ol>
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
        {question.label}{" "}
        {question.required && <span className="text-red-500">*</span>}
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
              ? "bg-green-600 text-white border-green-600 shadow"
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
              ? "bg-red-500 text-white border-red-500 shadow"
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
                  ? "bg-brand-600 text-white border-brand-600 shadow"
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
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(String(star))}
            className={`text-3xl transition transform hover:scale-110 ${
              star <= numValue
                ? "text-yellow-400"
                : "text-slate-300 hover:text-yellow-300"
            }`}
            aria-label={`${star} z 5`}
          >
            ★
          </button>
        ))}
        {numValue > 0 && (
          <span className="ml-2 text-sm text-slate-600">{numValue}/5</span>
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

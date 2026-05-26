"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { cs } from "date-fns/locale";

type Provider = { id: string; name: string; bio: string | null };
type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCzk: number;
  showPrice: boolean;
  locationType: string;
  locationDetail: string | null;
  providers: Provider[];
};

type Step = "service" | "provider" | "slot" | "form" | "done";

function locationLabel(type: string): string {
  switch (type) {
    case "in_person":
      return "Osobně";
    case "online":
      return "Online";
    case "phone":
      return "Telefonicky";
    default:
      return "Místo upřesní poskytovatel";
  }
}
function locationEmoji(type: string): string {
  switch (type) {
    case "in_person":
      return "📍";
    case "online":
      return "💻";
    case "phone":
      return "📞";
    default:
      return "📌";
  }
}

export function BookingFlow({
  tenantSlug,
  services,
  initialServiceId,
}: {
  tenantSlug: string;
  services: Service[];
  initialServiceId?: string;
}) {
  const [step, setStep] = useState<Step>(
    initialServiceId ? "provider" : "service",
  );
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId ?? null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{
    bookingId: string;
    emailSent: boolean;
    smsSent: boolean;
  } | null>(null);

  const service = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );
  const provider = useMemo(
    () => service?.providers.find((p) => p.id === providerId) ?? null,
    [service, providerId],
  );

  useEffect(() => {
    if (step !== "slot" || !serviceId || !providerId) return;
    setLoadingSlots(true);
    fetch(
      `/api/availability?tenantSlug=${tenantSlug}&serviceId=${serviceId}&providerId=${providerId}&date=${format(date, "yyyy-MM-dd")}`,
    )
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [step, serviceId, providerId, date, tenantSlug]);

  async function submitBooking() {
    if (!selectedSlot || !service || !provider) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          serviceId: service.id,
          providerId: provider.id,
          startsAt: selectedSlot.start,
          client: formData,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Něco se nepovedlo.");
        return;
      }
      setBookingResult({
        bookingId: json.bookingId,
        emailSent: json.emailSent ?? false,
        smsSent: json.smsSent ?? false,
      });
      setStep("done");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const dateOptions = Array.from({ length: 14 }, (_, i) =>
    addDays(startOfDay(new Date()), i),
  );

  return (
    <div className="space-y-6">
      <Steps current={step} />

      {step === "service" && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">1. Vyberte typ schůzky</h2>
          <div className="space-y-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setStep("provider");
                }}
                className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-brand-500 hover:bg-brand-50 transition"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-slate-600">
                    {s.showPrice && s.priceCzk > 0 ? `${s.priceCzk} Kč · ` : ""}
                    {s.durationMinutes} min
                  </span>
                </div>
                {s.description && (
                  <p className="text-sm text-slate-500 mt-1">{s.description}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {locationEmoji(s.locationType)} {locationLabel(s.locationType)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "provider" && service && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-1">2. Vyberte osobu</h2>
          <p className="text-sm text-slate-600 mb-4">
            <strong>{service.name}</strong> · {service.durationMinutes} min
          </p>
          <div className="space-y-2">
            {service.providers.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProviderId(p.id);
                  setStep("slot");
                }}
                className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-brand-500 hover:bg-brand-50 transition"
              >
                <div className="font-medium">{p.name}</div>
                {p.bio && <p className="text-sm text-slate-500 mt-1">{p.bio}</p>}
              </button>
            ))}
            {service.providers.length === 0 && (
              <p className="text-slate-500">Tento typ schůzky zatím nikdo nenabízí.</p>
            )}
          </div>
          <button onClick={() => setStep("service")} className="btn-secondary mt-4">
            Zpět
          </button>
        </div>
      )}

      {step === "slot" && service && provider && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-1">3. Vyberte termín</h2>
          <p className="text-sm text-slate-600 mb-4">
            <strong>{service.name}</strong> · {provider.name}
          </p>

          <div className="label">Datum</div>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {dateOptions.map((d) => {
              const selected = format(d, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setDate(d)}
                  className={`shrink-0 px-3 py-2 rounded-lg border text-sm ${
                    selected
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white border-slate-200 hover:border-brand-500"
                  }`}
                >
                  <div className="text-xs">{format(d, "EEE", { locale: cs })}</div>
                  <div className="font-semibold">{format(d, "d. M.")}</div>
                </button>
              );
            })}
          </div>

          <div className="label">Volné časy</div>
          {loadingSlots ? (
            <p className="text-slate-500">Načítám…</p>
          ) : slots.length === 0 ? (
            <p className="text-slate-500">V tento den už nejsou volné časy.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep("form");
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-500 hover:bg-brand-50 text-sm font-medium"
                >
                  {format(new Date(slot.start), "HH:mm")}
                </button>
              ))}
            </div>
          )}

          <button onClick={() => setStep("provider")} className="btn-secondary mt-4">
            Zpět
          </button>
        </div>
      )}

      {step === "form" && service && provider && selectedSlot && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-1">4. Vaše údaje</h2>
          <div className="text-sm text-slate-600 mb-6 space-y-1">
            <div>
              <strong>{service.name}</strong> · {provider.name}
            </div>
            <div>
              📅{" "}
              {format(new Date(selectedSlot.start), "EEEE d. M. yyyy 'v' HH:mm", {
                locale: cs,
              })}
            </div>
            <div>
              {locationEmoji(service.locationType)} {locationLabel(service.locationType)}
              {service.locationDetail ? ` — ${service.locationDetail}` : ""}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitBooking();
            }}
            className="space-y-4"
          >
            <div>
              <label className="label">Jméno a příjmení *</label>
              <input
                required
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                required
                type="email"
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Telefon *</label>
              <input
                required
                type="tel"
                placeholder="+420…"
                className="input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Poznámka (volitelná)</label>
              <textarea
                rows={3}
                className="input"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("slot")}
                className="btn-secondary"
              >
                Zpět
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Odesílám…" : "Potvrdit rezervaci"}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === "done" && bookingResult && service && provider && selectedSlot && (
        <div className="card text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-2xl font-semibold mb-2">Rezervace potvrzena</h2>
          <div className="text-slate-600 mb-4 space-y-1">
            <div>
              <strong>{service.name}</strong> · {provider.name}
            </div>
            <div>
              {format(new Date(selectedSlot.start), "EEEE d. M. yyyy 'v' HH:mm", {
                locale: cs,
              })}
            </div>
            <div className="text-sm">
              {locationEmoji(service.locationType)} {locationLabel(service.locationType)}
              {service.locationDetail ? ` — ${service.locationDetail}` : ""}
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {bookingResult.emailSent
              ? "📧 Potvrzovací email byl odeslán."
              : "📧 Email nebyl odeslán (Resend nenakonfigurován)."}
            <br />
            {bookingResult.smsSent
              ? "📱 SMS s potvrzením byla odeslána."
              : "📱 SMS notifikace nejsou aktivní."}
          </p>
          <p className="text-xs text-slate-400 mt-4">
            Číslo rezervace: {bookingResult.bookingId}
          </p>
          <a href={`/${tenantSlug}`} className="btn-primary mt-6 inline-block">
            Zpět na úvod
          </a>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "service", label: "Typ schůzky" },
    { id: "provider", label: "Osoba" },
    { id: "slot", label: "Termín" },
    { id: "form", label: "Údaje" },
  ];
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2 text-sm flex-wrap">
      {steps.map((s, i) => {
        const done = i < currentIdx || current === "done";
        const active = i === currentIdx;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                done
                  ? "bg-brand-600 text-white"
                  : active
                    ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "font-medium" : "text-slate-500"}>{s.label}</span>
            {i < steps.length - 1 && <span className="text-slate-300">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

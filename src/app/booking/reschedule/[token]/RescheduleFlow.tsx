"use client";

import { useMemo, useState } from "react";
import { czWeekdayDayMonth, czTime } from "@/lib/datetime";

type Slot = { id: string; startsAt: string; endsAt: string };

export function RescheduleFlow({
  token,
  tenantName,
  listingTitle,
  address,
  clientName,
  slots,
}: {
  token: string;
  tenantName: string;
  listingTitle: string;
  address: string | null;
  clientName: string;
  slots: Slot[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seskupení termínů podle dne
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = czWeekdayDayMonth(new Date(s.startsAt));
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [slots]);

  async function pick(slot: Slot) {
    if (busy) return;
    setBusy(slot.id);
    setError(null);
    try {
      const res = await fetch(`/api/booking-reschedule/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: slot.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Něco se nepovedlo.");
        return;
      }
      setDone(slot);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-3xl shadow-lg">
          ✅
        </div>
        <h2 className="text-xl font-bold mt-4 mb-2">Termín přeplánován!</h2>
        <p className="text-slate-600">
          Nový termín:{" "}
          <strong>
            {czWeekdayDayMonth(new Date(done.startsAt))} v{" "}
            {czTime(new Date(done.startsAt))}
          </strong>
          . Potvrzení jsme Vám poslali e-mailem. 📧
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-5">
        <div className="text-sm text-slate-500">{tenantName}</div>
        <h1 className="text-xl font-bold mt-1">Vyberte nový termín</h1>
        <p className="text-slate-600 text-sm mt-1">{listingTitle}</p>
        {address && <p className="text-xs text-slate-500">📍 {address}</p>}
        <p className="text-xs text-slate-400 mt-2">
          Vaše údaje i odpovědi z formuláře už máme — stačí kliknout na termín. 🙂
        </p>
      </div>

      {error && (
        <p className="text-red-600 text-sm text-center mb-3">{error}</p>
      )}

      {slots.length === 0 ? (
        <div className="text-center text-slate-500 py-8">
          <div className="text-3xl mb-2">📅</div>
          Momentálně nejsou volné termíny. Zkuste to prosím později nebo nás
          kontaktujte.
        </div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {byDay.map(([day, daySlots]) => (
            <div key={day}>
              <div className="text-sm font-semibold text-slate-700 mb-2">
                {day}
              </div>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pick(s)}
                    disabled={!!busy}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
                  >
                    {busy === s.id ? "…" : czTime(new Date(s.startsAt))}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

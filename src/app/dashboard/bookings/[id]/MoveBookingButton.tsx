"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { czWeekdayDayMonth, czTime } from "@/lib/datetime";

type Slot = { id: string; startsAt: string };

export function MoveBookingButton({
  bookingId,
  slots,
}: {
  bookingId: string;
  slots: Slot[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function move(slot: Slot) {
    if (busy) return;
    if (
      !confirm(
        `Přeplánovat na ${czWeekdayDayMonth(new Date(slot.startsAt))} v ${czTime(
          new Date(slot.startsAt),
        )}?\n\nRezervace se přesune (otázky i odpovědi zůstanou) a klientovi přijde e-mail s novým termínem.`,
      )
    )
      return;
    setBusy(slot.id);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: slot.id }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Přeplánování se nepodařilo.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 rounded-md border border-brand-200 text-brand-700 font-medium hover:border-brand-500"
      >
        📅 Přeplánovat na termín
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-left max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1">Přeplánovat na jiný termín</h3>
            <p className="text-sm text-slate-600 mb-4">
              Vyberte nový volný termín. Rezervace se přesune (jméno, e-mail,
              telefon i odpovědi zůstanou) a klientovi přijde e-mail.
            </p>

            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

            {slots.length === 0 ? (
              <div className="text-center text-slate-500 py-6">
                Žádné volné termíny u této nemovitosti. Přidejte nový v sekci
                Nemovitosti → Termíny.
              </div>
            ) : (
              <div className="space-y-4">
                {byDay.map(([day, daySlots]) => (
                  <div key={day}>
                    <div className="text-sm font-semibold text-slate-700 mb-2">
                      {day}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => move(s)}
                          disabled={!!busy}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
                        >
                          {busy === s.id ? "…" : czTime(new Date(s.startsAt))}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 text-right">
              <button
                onClick={() => setOpen(false)}
                className="btn-secondary"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

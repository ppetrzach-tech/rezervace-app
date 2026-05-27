"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Hour = { id?: string; weekday: number; startMin: number; endMin: number };
type Provider = { id: string; name: string; hours: Hour[] };

const WEEKDAYS = [
  { wd: 1, label: "Pondělí" },
  { wd: 2, label: "Úterý" },
  { wd: 3, label: "Středa" },
  { wd: 4, label: "Čtvrtek" },
  { wd: 5, label: "Pátek" },
  { wd: 6, label: "Sobota" },
  { wd: 0, label: "Neděle" },
];

function minToTime(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function HoursManager({
  initialProviders,
}: {
  initialProviders: Provider[];
}) {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [saving, setSaving] = useState<string | null>(null);

  function updateHourLocally(
    providerIdx: number,
    weekday: number,
    field: "startMin" | "endMin",
    value: number,
  ) {
    const p = providers[providerIdx];
    const existing = p.hours.find((h) => h.weekday === weekday);
    let newHours: Hour[];
    if (existing) {
      newHours = p.hours.map((h) =>
        h.weekday === weekday ? { ...h, [field]: value } : h,
      );
    } else {
      newHours = [
        ...p.hours,
        {
          weekday,
          startMin: field === "startMin" ? value : 9 * 60,
          endMin: field === "endMin" ? value : 17 * 60,
        },
      ];
    }
    const updated = [...providers];
    updated[providerIdx] = { ...p, hours: newHours };
    setProviders(updated);
  }

  function toggleDay(providerIdx: number, weekday: number, enabled: boolean) {
    const p = providers[providerIdx];
    let newHours: Hour[];
    if (enabled) {
      const has = p.hours.find((h) => h.weekday === weekday);
      if (has) return;
      newHours = [
        ...p.hours,
        { weekday, startMin: 9 * 60, endMin: 17 * 60 },
      ];
    } else {
      newHours = p.hours.filter((h) => h.weekday !== weekday);
    }
    const updated = [...providers];
    updated[providerIdx] = { ...p, hours: newHours };
    setProviders(updated);
  }

  async function saveProvider(providerIdx: number) {
    const p = providers[providerIdx];
    setSaving(p.id);
    try {
      const res = await fetch(`/api/dashboard/providers/${p.id}/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: p.hours }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Uložení selhalo");
      } else {
        router.refresh();
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {providers.length === 0 && (
        <div className="card text-center text-slate-500">
          Nemáte aktivní osoby. Přidejte je v sekci „Tým".
        </div>
      )}
      {providers.map((p, idx) => (
        <div key={p.id} className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">{p.name}</h3>
            <button
              onClick={() => saveProvider(idx)}
              disabled={saving === p.id}
              className="btn-primary"
            >
              {saving === p.id ? "Ukládám…" : "Uložit"}
            </button>
          </div>
          <div className="space-y-2">
            {WEEKDAYS.map((day) => {
              const hour = p.hours.find((h) => h.weekday === day.wd);
              const enabled = !!hour;
              return (
                <div
                  key={day.wd}
                  className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
                >
                  <label className="w-28 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => toggleDay(idx, day.wd, e.target.checked)}
                    />
                    {day.label}
                  </label>
                  {enabled ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        className="input w-28"
                        value={minToTime(hour!.startMin)}
                        onChange={(e) =>
                          updateHourLocally(idx, day.wd, "startMin", timeToMin(e.target.value))
                        }
                      />
                      <span className="text-slate-500">–</span>
                      <input
                        type="time"
                        className="input w-28"
                        value={minToTime(hour!.endMin)}
                        onChange={(e) =>
                          updateHourLocally(idx, day.wd, "endMin", timeToMin(e.target.value))
                        }
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Zavřeno</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

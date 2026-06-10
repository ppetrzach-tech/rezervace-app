"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Přeplánování rezervace vlastníkem/asistentem: zruší stávající termín,
 * uvolní slot, smaže událost v kalendáři a pošle klientovi e-mail s výzvou,
 * ať si vybere nový termín.
 */
export function RescheduleButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reschedule() {
    if (
      !confirm(
        "Přeplánovat tuto rezervaci?\n\nStávající termín se zruší a klientovi přijde e-mail s odkazem na výběr nového termínu.",
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reschedule" }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Přeplánování se nepodařilo.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={reschedule}
      disabled={busy}
      className="text-sm px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 font-medium hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
    >
      {busy ? "Přeplánovávám…" : "🔄 Přeplánovat"}
    </button>
  );
}

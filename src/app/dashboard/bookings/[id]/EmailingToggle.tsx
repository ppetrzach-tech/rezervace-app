"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EmailingToggle({
  bookingId,
  stopped,
}: {
  bookingId: string;
  stopped: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !stopped;
    if (
      next &&
      !confirm(
        "Zastavit další automatické emaily tomuto klientovi?\n\nNepošlou se připomínky ani follow-upy.",
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/dashboard/bookings/${bookingId}/emailing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stopped: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Změna selhala");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`text-sm px-3 py-1.5 rounded-md border font-medium ${
        stopped
          ? "bg-green-600 border-green-600 text-white hover:bg-green-700"
          : "bg-white border-slate-200 text-slate-600 hover:border-orange-400 hover:text-orange-700"
      }`}
    >
      {busy
        ? "…"
        : stopped
          ? "▶ Obnovit emaily"
          : "⏸ Zastavit další emaily"}
    </button>
  );
}

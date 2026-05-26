"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm("Opravdu zrušit tuto rezervaci?")) return;
    setBusy(true);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Zrušení se nepodařilo.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={cancel}
      disabled={busy}
      className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
    >
      {busy ? "Ruším…" : "Zrušit"}
    </button>
  );
}

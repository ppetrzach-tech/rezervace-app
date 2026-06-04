"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ActiveToggle({
  propertyId,
  active,
}: {
  propertyId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !active;
    if (
      next === false &&
      !confirm(
        "Deaktivovat nemovitost?\n\nKlienti ji už neuvidí ani si nezarezervují termín. Přesune se do sekce „Neaktivní". Kdykoliv ji můžete znovu aktivovat.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/dashboard/properties/${propertyId}/toggle-active`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: next }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Změna selhala");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (e) {
      alert(String(e));
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`text-xs px-2.5 py-1.5 rounded-md border font-medium transition ${
        active
          ? "bg-white border-slate-200 text-slate-600 hover:border-orange-400 hover:text-orange-700"
          : "bg-green-600 border-green-600 text-white hover:bg-green-700"
      }`}
      title={active ? "Skrýt před klienty" : "Zveřejnit klientům"}
    >
      {busy ? "…" : active ? "Deaktivovat" : "✓ Aktivovat"}
    </button>
  );
}

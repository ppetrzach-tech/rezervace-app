"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DuplicateButton({
  propertyId,
  className = "",
  label = "⧉ Duplikovat",
}: {
  propertyId: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    if (
      !confirm(
        "Vytvořit kopii této nemovitosti?\n\nZkopírují se všechny otázky, odkazy a nastavení. Termíny (sloty) se nekopírují — ty přidáte u kopie zvlášť.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/dashboard/properties/${propertyId}/duplicate`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Duplikace selhala");
        setBusy(false);
        return;
      }
      // Otevřít editor kopie
      router.push(`/dashboard/properties/${json.id}`);
    } catch (e) {
      alert(String(e));
      setBusy(false);
    }
  }

  return (
    <button
      onClick={duplicate}
      disabled={busy}
      className={`btn-secondary text-xs justify-center ${className}`}
      title="Vytvořit kopii i s otázkami"
    >
      {busy ? "Kopíruji…" : label}
    </button>
  );
}

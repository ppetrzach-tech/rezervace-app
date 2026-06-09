"use client";

import { useState } from "react";

type Action = "reschedule" | "cancel" | "decline";

export function ManageActions({
  token,
  isFuture,
}: {
  token: string;
  isFuture: boolean;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [done, setDone] = useState<{ action: Action; propertyUrl: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    if (action === "cancel" && !confirm("Opravdu zrušit tento termín?")) return;
    if (
      action === "decline" &&
      !confirm("Potvrzujete, že už nemáte zájem? Přestaneme vám psát.")
    )
      return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/booking-manage/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Něco se nepovedlo.");
        return;
      }
      setDone({ action, propertyUrl: json.propertyUrl });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    if (done.action === "reschedule") {
      return (
        <div>
          <div className="text-4xl mb-3">📅</div>
          <h2 className="text-xl font-semibold mb-2">Termín zrušen</h2>
          <p className="text-slate-600 mb-5">
            Vyberte si prosím nový termín, který vám vyhovuje.
          </p>
          <a href={done.propertyUrl} className="btn-primary inline-block">
            Vybrat nový termín
          </a>
        </div>
      );
    }
    if (done.action === "cancel") {
      return (
        <div>
          <div className="text-4xl mb-3">✓</div>
          <h2 className="text-xl font-semibold mb-2">Termín zrušen</h2>
          <p className="text-slate-600">
            Potvrzení jsme vám poslali e-mailem. Kdykoliv si můžete vybrat nový
            termín.
          </p>
        </div>
      );
    }
    return (
      <div>
        <div className="text-4xl mb-3">🙏</div>
        <h2 className="text-xl font-semibold mb-2">Děkujeme za zpětnou vazbu</h2>
        <p className="text-slate-600">
          Rozumíme — už vás nebudeme kontaktovat. Přejeme hezký den.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-slate-600 mb-4">Co byste rádi udělali?</p>

      {isFuture && (
        <>
          <button
            onClick={() => run("reschedule")}
            disabled={!!busy}
            className="btn-primary w-full justify-center"
          >
            {busy === "reschedule" ? "Zpracovávám…" : "🔄 Přeplánovat na jiný termín"}
          </button>
          <button
            onClick={() => run("cancel")}
            disabled={!!busy}
            className="btn-secondary w-full justify-center"
          >
            {busy === "cancel" ? "Zpracovávám…" : "❌ Zrušit termín"}
          </button>
        </>
      )}

      <button
        onClick={() => run("decline")}
        disabled={!!busy}
        className="w-full justify-center text-sm text-slate-500 hover:text-red-600 py-2"
      >
        {busy === "decline"
          ? "Zpracovávám…"
          : "🚫 Už nemám zájem — nekontaktovat"}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

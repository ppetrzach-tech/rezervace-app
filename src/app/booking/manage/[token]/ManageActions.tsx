"use client";

import { useState } from "react";

type Action = "reschedule" | "cancel" | "decline";

const MODAL: Record<
  Action,
  { title: string; hint: string; cta: string; reasons: string[] }
> = {
  reschedule: {
    title: "Přeplánovat termín",
    hint: "Z jakého důvodu vám termín nevyhovuje?",
    cta: "Přeplánovat termín",
    reasons: [
      "Nehodí se mi čas",
      "Onemocněl/a jsem",
      "Vznikla mi jiná povinnost",
      "Potřebuji pozdější termín",
    ],
  },
  cancel: {
    title: "Zrušit termín",
    hint: "Z jakého důvodu termín rušíte?",
    cta: "Zrušit termín",
    reasons: [
      "Změnily se mi plány",
      "Našel/a jsem jinou nemovitost",
      "Nevyhovuje lokalita",
      "Nevyhovuje cena",
    ],
  },
  decline: {
    title: "Už nemám zájem",
    hint: "Můžete nám prosím napsat proč? Pomůže nám to zlepšit se.",
    cta: "Odeslat a nekontaktovat",
    reasons: [
      "Už mám vyřešeno jinak",
      "Nevyhovuje cena",
      "Nevyhovuje nemovitost",
      "Změnily se mi plány",
    ],
  },
};

export function ManageActions({
  token,
  isFuture,
}: {
  token: string;
  isFuture: boolean;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    action: Action;
    propertyUrl: string;
    rescheduleUrl?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(action: Action) {
    setPending(action);
    setReason("");
    setError(null);
  }

  function close() {
    setPending(null);
    setReason("");
    setError(null);
  }

  async function submit() {
    if (!pending) return;
    if (reason.trim().length === 0) {
      setError("Uveďte prosím důvod — pole je povinné.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking-manage/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pending, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Něco se nepovedlo.");
        return;
      }
      setDone({
        action: pending,
        propertyUrl: json.propertyUrl,
        rescheduleUrl: json.rescheduleUrl,
      });
      setPending(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    if (done.action === "reschedule") {
      return (
        <div>
          <div className="text-4xl mb-3">📅</div>
          <h2 className="text-xl font-semibold mb-2">Termín zrušen</h2>
          <p className="text-slate-600 mb-5">
            Vyberte si nový termín — vaše údaje i odpovědi už máme, stačí kliknout.
          </p>
          <a
            href={done.rescheduleUrl || done.propertyUrl}
            className="btn-primary inline-block"
          >
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

  const cfg = pending ? MODAL[pending] : null;

  return (
    <div className="space-y-3">
      <p className="text-slate-600 mb-4">Co byste rádi udělali?</p>

      {isFuture && (
        <>
          <button
            onClick={() => open("reschedule")}
            className="btn-primary w-full justify-center"
          >
            🔄 Přeplánovat na jiný termín
          </button>
          <button
            onClick={() => open("cancel")}
            className="btn-secondary w-full justify-center"
          >
            ❌ Zrušit termín
          </button>
        </>
      )}

      <button
        onClick={() => open("decline")}
        className="w-full justify-center text-sm text-slate-500 hover:text-red-600 py-2"
      >
        🚫 Už nemám zájem — nekontaktovat
      </button>

      {/* Modal s povinným důvodem */}
      {cfg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1">{cfg.title}</h3>
            <p className="text-sm text-slate-600 mb-4">{cfg.hint}</p>

            <label className="block text-sm font-medium mb-1">
              Důvod <span className="text-red-500">*</span>
            </label>

            <div className="flex flex-wrap gap-2 mb-3">
              {cfg.reasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    reason === r
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-brand-500"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              placeholder="Napište prosím důvod…"
              className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            />

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

            <div className="flex gap-2 mt-4">
              <button
                onClick={close}
                disabled={busy}
                className="btn-secondary flex-1 justify-center"
              >
                Zpět
              </button>
              <button
                onClick={submit}
                disabled={busy || reason.trim().length === 0}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {busy ? "Odesílám…" : cfg.cta}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !cfg && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";

const FINANCING = ["Hotovost", "Hypotéka", "Kombinace", "Zatím nevím"];

export function OfferForm({
  tenantSlug,
  listingSlug,
  listingTitle,
}: {
  tenantSlug: string;
  listingSlug: string;
  listingTitle: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [financing, setFinancing] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatAmount(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("cs-CZ").format(Number(digits));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountCzk = Number(amount.replace(/\D/g, "")) || undefined;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Vyplňte prosím jméno, e-mail a telefon.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          listingSlug,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          amountCzk,
          financing: financing || undefined,
          message: message.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Něco se nepovedlo.");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-semibold mb-2">Nabídka odeslána — děkujeme!</h2>
        <p className="text-slate-600">
          Vaši cenovou nabídku jsme přijali a brzy se Vám ozveme. Potvrzení
          jsme Vám poslali e-mailem.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">
        Máte zájem o <strong>{listingTitle}</strong>? Pošlete nezávaznou cenovou
        nabídku — ozveme se Vám.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">
          Jméno a příjmení <span className="text-red-500">*</span>
        </label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            E-mail <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Telefon <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Nabízená cena (Kč)</label>
        <div className="relative">
          <input
            inputMode="numeric"
            className="input pr-10"
            placeholder="např. 4 500 000"
            value={amount}
            onChange={(e) => setAmount(formatAmount(e.target.value))}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            Kč
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Financování</label>
        <div className="flex flex-wrap gap-2">
          {FINANCING.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFinancing(f === financing ? "" : f)}
              className={`text-sm px-3 py-1.5 rounded-full border transition ${
                financing === f
                  ? "bg-brand-600 border-brand-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:border-brand-500"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Zpráva (volitelné)</label>
        <textarea
          className="input"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Termín nastěhování, podmínky, dotazy…"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
        {busy ? "Odesílám…" : "Odeslat nabídku"}
      </button>
      <p className="text-xs text-slate-400 text-center">
        Nezávazné — slouží k zahájení jednání.
      </p>
    </form>
  );
}

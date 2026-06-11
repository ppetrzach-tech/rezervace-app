"use client";

import { useState } from "react";

const FINANCING = ["Hotovost", "Hypotéka", "Kombinace", "Zatím nevím"];

export function OfferForm({
  tenantSlug,
  listingSlug,
}: {
  tenantSlug: string;
  listingSlug: string;
  listingTitle?: string;
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
    if (!amountCzk) {
      setError("Uveďte prosím nabízenou cenu.");
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
      <div className="text-center py-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-3xl shadow-lg">
          ✅
        </div>
        <h2 className="text-xl font-bold mt-4 mb-2">
          Nabídka odeslána — děkujeme!
        </h2>
        <p className="text-slate-600">
          Vaši cenovou nabídku jsme přijali a brzy se Vám ozveme. Potvrzení
          jsme Vám poslali e-mailem. 📧
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600 leading-relaxed">
        Právě se nacházíte na stránce, kde stačí vyplnit formulář a napsat zde
        Vaši cenu, kterou jste připraveni investovat do své budoucí nemovitosti.
        Vaše údaje nám potvrdí Váš seriózní zájem o tuto nabídku. Začněte svou
        cestu k novému bydlení.
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

      <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
        <label className="block text-sm font-semibold text-green-800 mb-1">
          💰 Vaše nabízená cena <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            inputMode="numeric"
            className="w-full rounded-lg border border-green-300 bg-white px-3 py-3 pr-12 text-2xl font-bold text-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="4 500 000"
            value={amount}
            onChange={(e) => setAmount(formatAmount(e.target.value))}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 font-semibold">
            Kč
          </span>
        </div>
        <p className="text-xs text-green-700/80 mt-1">
          Cena, kterou jste připraveni za nemovitost nabídnout.
        </p>
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
        Odesláním stvrzujete vážný zájem o koupi za uvedenou cenu.
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setLoading(false);
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2">Obnovení hesla</h1>
        {sent ? (
          <div className="text-slate-600 text-sm">
            <div className="text-3xl mb-2">📧</div>
            Pokud účet s tímto e-mailem existuje, poslali jsme na něj odkaz pro
            nastavení nového hesla. Zkontrolujte si schránku (i spam). Odkaz
            platí 1 hodinu.
            <div className="mt-4">
              <Link href="/login" className="text-brand-700 font-medium">
                ← Zpět na přihlášení
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-4">
              Zadejte e-mail svého účtu a pošleme vám odkaz pro nastavení nového
              hesla.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? "Odesílám…" : "Poslat odkaz"}
              </button>
            </form>
            <p className="text-sm text-slate-500 mt-6 text-center">
              <Link href="/login" className="text-brand-700 font-medium">
                ← Zpět na přihlášení
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PasswordChecklist, passwordValid } from "../PasswordChecklist";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordValid(password)) {
      setError("Heslo nesplňuje požadavky níže.");
      return;
    }
    if (password !== password2) {
      setError("Hesla se neshodují.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Nepodařilo se nastavit heslo.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (!token) {
    return (
      <div className="text-slate-600 text-sm">
        Chybí platný odkaz. Požádejte prosím o nový na{" "}
        <Link href="/forgot-password" className="text-brand-700">
          obnovení hesla
        </Link>
        .
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-2">✅</div>
        <h2 className="text-lg font-semibold mb-1">Heslo nastaveno</h2>
        <p className="text-slate-600 text-sm">
          Za chvíli vás přesměrujeme na přihlášení…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">Zvolte si nové heslo (min. 10 znaků).</p>
      <div>
        <label className="label">Nové heslo</label>
        <input
          type="password"
          required
          minLength={10}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <PasswordChecklist value={password} />
      </div>
      <div>
        <label className="label">Heslo znovu</label>
        <input
          type="password"
          required
          minLength={10}
          className="input"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !passwordValid(password) || password !== password2}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? "Ukládám…" : "Nastavit heslo"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4">Nové heslo</h1>
        <Suspense fallback={<div className="text-sm text-slate-500">Načítám…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}

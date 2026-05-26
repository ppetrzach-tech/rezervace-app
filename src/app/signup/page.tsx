"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    slug: "",
    name: "",
    email: "",
    password: "",
    inviteCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Registrace selhala.");
        setLoading(false);
        return;
      }
      // Auto-login
      const signinRes = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      setLoading(false);
      if (signinRes?.error) {
        setError("Účet vytvořen, ale přihlášení selhalo. Zkuste se přihlásit ručně.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError(String(err));
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Vytvořit účet</h1>
        <p className="text-sm text-slate-600 mb-6">
          Vyplňte základní údaje vaší firmy.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Název firmy *</label>
            <input
              required
              className="input"
              placeholder="např. Salon Krásy"
              value={form.businessName}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  businessName: v,
                  slug: form.slug || autoSlug(v),
                });
              }}
            />
          </div>
          <div>
            <label className="label">URL stránky *</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">.../</span>
              <input
                required
                className="input"
                placeholder="salon-krasy"
                value={form.slug}
                onChange={(e) =>
                  setForm({ ...form, slug: autoSlug(e.target.value) })
                }
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Klienti budou rezervovat na adrese <code>tato-stránka.cz/{form.slug || "vase-firma"}</code>
            </p>
          </div>
          <hr className="border-slate-200" />
          <div>
            <label className="label">Vaše jméno *</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              required
              type="email"
              className="input"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Heslo *</label>
            <input
              required
              type="password"
              minLength={8}
              className="input"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">Alespoň 8 znaků.</p>
          </div>
          <div>
            <label className="label">Pozvánkový kód *</label>
            <input
              required
              className="input"
              placeholder="Kód, který jste dostal/a"
              value={form.inviteCode}
              onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Zakládám účet…" : "Vytvořit účet"}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-6 text-center">
          Už máte účet?{" "}
          <Link href="/login" className="text-brand-700 font-medium">
            Přihlásit
          </Link>
        </p>
      </div>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  providerId: string | null;
};

export function TeamLogins({
  currentUserEmail,
  initialUsers,
  providers,
}: {
  currentUserEmail: string;
  initialUsers: TeamUser[];
  providers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    providerId: "",
    accessType: "all" as "all" | "own",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/team-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          providerId:
            form.accessType === "own" && form.providerId ? form.providerId : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: json.error ?? "Vytvoření selhalo" });
        return;
      }
      setMsg({
        ok: true,
        text: `Login pro ${form.name} vytvořen. Předejte mu email a heslo.`,
      });
      setForm({ name: "", email: "", password: "", providerId: "", accessType: "all" });
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Smazat login pro ${name}? Tato osoba se už nepřihlásí.`)) return;
    const res = await fetch(`/api/dashboard/team-users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Smazání selhalo");
      return;
    }
    router.refresh();
  }

  function genPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let p = "";
    for (let i = 0; i < 12; i++) {
      p += chars[Math.floor(Math.random() * chars.length)];
    }
    setForm((f) => ({ ...f, password: p }));
  }

  return (
    <div className="space-y-3">
      {/* Seznam loginů */}
      <div className="space-y-2">
        {initialUsers.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-white"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {u.name}
                  {u.email === currentUserEmail && (
                    <span className="text-xs text-slate-400 ml-1">(vy)</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {u.role === "owner" ? (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                  👑 Vlastník
                </span>
              ) : u.providerId ? (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                  Jen své rezervace
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                  Spolupracovník
                </span>
              )}
              {u.role !== "owner" && (
                <button
                  onClick={() => remove(u.id, u.name)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Smazat
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div
          className={`text-sm px-3 py-2 rounded-lg ${
            msg.ok
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Vytvořit login pro spolupracovníka
        </button>
      ) : (
        <form
          onSubmit={create}
          className="card space-y-4 border-brand-200"
        >
          <h3 className="font-semibold">Nový login</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Jméno *</label>
              <input
                required
                className="input"
                placeholder="Jana Asistentka"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email (login) *</label>
              <input
                required
                type="email"
                className="input"
                placeholder="jana@firma.cz"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Heslo *</label>
            <div className="flex gap-2">
              <input
                required
                minLength={8}
                className="input font-mono"
                placeholder="min. 8 znaků"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={genPassword}
                className="btn-secondary whitespace-nowrap"
              >
                🎲 Vygenerovat
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Heslo si poznamenejte a předejte spolupracovníkovi — pak si ho může
              změnit v Nastavení → Účet.
            </p>
          </div>

          <div>
            <label className="label">Rozsah přístupu</label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="access"
                  className="mt-1"
                  checked={form.accessType === "all"}
                  onChange={() => setForm({ ...form, accessType: "all" })}
                />
                <div>
                  <div className="font-medium text-sm">
                    Spolupracovník (plný přehled)
                  </div>
                  <div className="text-xs text-slate-500">
                    Vidí všechny rezervace a nemovitosti. Nemůže měnit nastavení a
                    API klíče. Ideální pro asistentku.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="access"
                  className="mt-1"
                  checked={form.accessType === "own"}
                  onChange={() => setForm({ ...form, accessType: "own" })}
                />
                <div>
                  <div className="font-medium text-sm">Jen vlastní rezervace</div>
                  <div className="text-xs text-slate-500">
                    Pro člena týmu, který vede vlastní prohlídky — uvidí jen své.
                  </div>
                </div>
              </label>
            </div>
            {form.accessType === "own" && (
              <select
                className="input mt-2"
                value={form.providerId}
                onChange={(e) => setForm({ ...form, providerId: e.target.value })}
                required
              >
                <option value="">— Vyberte osobu (poskytovatele) —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setMsg(null);
              }}
              className="btn-secondary"
            >
              Zrušit
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Vytvářím…" : "Vytvořit login"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

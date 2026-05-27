"use client";

import { useState } from "react";

export function AccountForm({
  initial,
}: {
  initial: { email: string; name: string };
}) {
  const [name, setName] = useState(initial.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/dashboard/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNameMsg({ ok: false, text: json.error ?? "Uložení selhalo" });
      } else {
        setNameMsg({ ok: true, text: "Uloženo. Pro projevení se odhlaste a přihlaste znovu." });
      }
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPwdMsg({ ok: false, text: "Nové heslo musí mít alespoň 8 znaků." });
      return;
    }
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      const res = await fetch("/api/dashboard/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPwdMsg({ ok: false, text: json.error ?? "Změna selhala" });
      } else {
        setPwdMsg({ ok: true, text: "Heslo změněno." });
        setCurrentPassword("");
        setNewPassword("");
      }
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <h3 className="font-semibold">Profil</h3>
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input bg-slate-50" value={initial.email} disabled />
            <p className="text-xs text-slate-500 mt-1">
              Email nelze měnit (slouží k přihlášení).
            </p>
          </div>
          <div>
            <label className="label">Jméno</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {nameMsg && (
            <p
              className={`text-sm ${
                nameMsg.ok ? "text-green-600" : "text-red-600"
              }`}
            >
              {nameMsg.text}
            </p>
          )}
          <button disabled={savingName} className="btn-primary">
            {savingName ? "Ukládám…" : "Uložit"}
          </button>
        </form>
      </section>

      <section className="card space-y-3">
        <h3 className="font-semibold">Změna hesla</h3>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="label">Současné heslo</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">Nové heslo (min. 8 znaků)</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          {pwdMsg && (
            <p className={`text-sm ${pwdMsg.ok ? "text-green-600" : "text-red-600"}`}>
              {pwdMsg.text}
            </p>
          )}
          <button disabled={savingPwd} className="btn-primary">
            {savingPwd ? "Měním…" : "Změnit heslo"}
          </button>
        </form>
      </section>
    </div>
  );
}

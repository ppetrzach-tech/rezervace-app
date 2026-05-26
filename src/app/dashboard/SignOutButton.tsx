"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-slate-600 hover:text-red-600"
    >
      Odhlásit
    </button>
  );
}

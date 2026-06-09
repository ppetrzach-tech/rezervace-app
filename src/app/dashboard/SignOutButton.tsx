"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  async function handleSignOut() {
    // redirect:false + ruční navigace → zůstaneme vždy na aktuální doméně
    // (nezávisle na NEXTAUTH_URL), takže žádný skok na *.vercel.app.
    await signOut({ redirect: false });
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-slate-600 hover:text-red-600"
    >
      Odhlásit
    </button>
  );
}

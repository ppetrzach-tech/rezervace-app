"use client";

import { useEffect, useState } from "react";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const [locale, setLocale] = useState<Locale>(current);
  const [open, setOpen] = useState(false);

  useEffect(() => setLocale(current), [current]);

  function change(l: Locale) {
    // Uložíme cookie na 1 rok
    document.cookie = `locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setLocale(l);
    setOpen(false);
    // Force reload pro server-side překlad
    window.location.reload();
  }

  const cur = LOCALE_NAMES[locale];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-sm transition"
        aria-label="Změnit jazyk"
      >
        <span className="text-lg">{cur.flag}</span>
        <span className="hidden sm:inline">{cur.native}</span>
        <span className="text-xs opacity-60">▼</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 bg-white text-slate-900 rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[140px]">
            {LOCALES.map((l) => {
              const meta = LOCALE_NAMES[l];
              const selected = l === locale;
              return (
                <button
                  key={l}
                  onClick={() => change(l)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                    selected ? "font-semibold text-brand-700" : ""
                  }`}
                >
                  <span className="text-lg">{meta.flag}</span>
                  <span>{meta.native}</span>
                  {selected && <span className="ml-auto">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

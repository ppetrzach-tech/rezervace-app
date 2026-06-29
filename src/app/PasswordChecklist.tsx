"use client";

export function passwordRules(pw: string) {
  return [
    { label: "Alespoň 10 znaků", ok: pw.length >= 10 },
    { label: "Alespoň jedno písmeno", ok: /\p{L}/u.test(pw) },
    { label: "Alespoň jedno číslo", ok: /\d/.test(pw) },
  ];
}

export function passwordValid(pw: string): boolean {
  return passwordRules(pw).every((r) => r.ok);
}

/** Živý seznam požadavků na heslo — odškrtává se, co je splněno. */
export function PasswordChecklist({ value }: { value: string }) {
  const rules = passwordRules(value);
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {rules.map((r, i) => (
        <li
          key={i}
          className={`flex items-center gap-2 ${
            r.ok ? "text-green-600" : "text-slate-400"
          }`}
        >
          <span>{r.ok ? "✅" : "⬜️"}</span>
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

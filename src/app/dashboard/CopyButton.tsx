"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Kopírovat",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={copy}
      className={`btn-secondary text-xs flex-1 justify-center ${className}`}
    >
      {copied ? "✓ Zkopírováno" : label}
    </button>
  );
}

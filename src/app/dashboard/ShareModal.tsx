"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function ShareButton({
  url,
  label = "📲 Sdílet",
  title = "Sdílení odkazu",
}: {
  url: string;
  label?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary text-xs justify-center"
      >
        {label}
      </button>
      {open && <ShareModal url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ShareModal({
  url,
  title = "Sdílení odkazu",
  onClose,
}: {
  url: string;
  title?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function download() {
    // Najdeme SVG a převedeme na PNG pro stažení
    const svg = document.querySelector("#share-qr-svg") as SVGSVGElement | null;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "qr-rezervace.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }

  function nativeShare() {
    if (navigator.share) {
      navigator.share({ title: "Rezervace", url }).catch(() => {});
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <QRCodeSVG
                id="share-qr-svg"
                value={url}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>

          <p className="text-sm text-slate-600 text-center">
            Naskenujte QR kód mobilem, nebo zkopírujte odkaz
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono break-all">
            {url}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={copy} className="btn-primary justify-center">
              {copied ? "✓ Zkopírováno" : "📋 Kopírovat"}
            </button>
            <button onClick={download} className="btn-secondary justify-center">
              ⬇ Stáhnout QR
            </button>
          </div>

          {typeof navigator !== "undefined" &&
            typeof navigator.share === "function" && (
              <button
                onClick={nativeShare}
                className="btn-secondary w-full justify-center"
              >
                📤 Sdílet (systém)
              </button>
            )}

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-sm text-brand-700 hover:underline"
          >
            Otevřít odkaz ↗
          </a>
        </div>
      </div>
    </div>
  );
}

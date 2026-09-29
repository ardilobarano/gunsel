"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { proximityToSquare, type HaritasalGuessEntry } from "@/lib/haritasal";
import { cn, getTodayKey } from "@/lib/utils";

export default function SonucModal({
  won,
  answer,
  guesses,
  maxAttempts,
  kategoriEtiketi,
  onClose,
}: {
  won: boolean;
  /** Dünya sekmesinde bayrak, İller sekmesinde plaka gelir. */
  answer: { label: string; flag?: string; plaka?: number };
  guesses: HaritasalGuessEntry[];
  maxAttempts: number;
  /** Paylaşım metnine giriyor — iki sekmenin sonucu karışmasın. */
  kategoriEtiketi: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function share() {
    // Kareler yakınlığı gösteriyor ama ÜLKEYİ ele vermiyor — paylaşılan sonuç
    // arkadaşın bulmacasını bozmasın diye (diğer oyunlardaki aynı kural).
    const kareler = guesses.map(proximityToSquare).join("");
    const sonuc = won ? `${guesses.length}/${maxAttempts}` : `X/${maxAttempts}`;
    const text = `Günsel Haritasal · ${kategoriEtiketi} ${getTodayKey()}\n${kareler} ${sonuc}\nhttps://gunsel.app/haritasal`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-subtle bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-center justify-between px-5 py-4", won ? "bg-accent-green" : "bg-accent-red")}>
          <h2 className="text-lg font-bold text-black">{won ? "Bildin!" : "Olmadı"}</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="text-black">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 px-5 py-5">
          {/* İllerin bayrağı yok; onun yerine plaka kodu — bayrakla aynı işi
              görüyor, cevabın kimliğini tek bakışta veriyor. */}
          {answer.flag ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={answer.flag} alt="" className="h-12 w-auto rounded border border-border-subtle" />
          ) : answer.plaka !== undefined ? (
            <span className="flex h-12 min-w-16 items-center justify-center rounded border border-border-subtle bg-background px-3 text-2xl font-bold tracking-wider text-text-main tabular-nums">
              {String(answer.plaka).padStart(2, "0")}
            </span>
          ) : null}
          <p className="text-xl font-bold text-text-main">{answer.label}</p>
          <p className="text-sm text-text-muted">
            {won ? `${guesses.length}/${maxAttempts} denemede` : `${maxAttempts} denemede bulunamadı`}
          </p>

          <button
            type="button"
            onClick={share}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Kopyalandı" : "Sonucu paylaş"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

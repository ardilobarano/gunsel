"use client";

import { useState } from "react";
import { Home, X } from "lucide-react";
import { getFrameUrl, type MovieGuessEntry } from "@/lib/karesel";
import { cn, getTodayKey } from "@/lib/utils";

interface ResultModalProps {
  status: "WON" | "LOST";
  answer: { title: string; originalTitle: string; year: string | null };
  frames: string[];
  guessRows: MovieGuessEntry[];
  maxAttempts: number;
  onClose: () => void;
  onHome: () => void;
}

export default function ResultModal({
  status,
  answer,
  frames,
  guessRows,
  maxAttempts,
  onClose,
  onHome,
}: ResultModalProps) {
  const [copied, setCopied] = useState(false);
  const won = status === "WON";
  const guessCount = guessRows.length;

  function handleShare() {
    const squares = Array.from({ length: maxAttempts }, (_, i) => {
      if (won && i === guessCount - 1) return "🟩";
      if (i >= guessCount) return "⬛";
      return "🟥";
    }).join("");
    const resultLabel = won ? `${guessCount}/${maxAttempts}` : `X/${maxAttempts}`;
    const text = `Günsel Karesel ${getTodayKey()}\n${squares} ${resultLabel}\nhttps://gunsel.app/karesel`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-subtle bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-center justify-between px-5 py-4", won ? "bg-accent-green" : "bg-accent-red")}>
          <h2 className="text-lg font-bold text-black">{won ? "Kazandın! 🎉" : "Oyun Bitti"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="text-black/70 transition-colors hover:text-black"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div className="rounded-lg border border-border-subtle bg-background px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Film şuydu</p>
            <p className="mt-1 text-lg font-semibold text-text-main">
              {answer.title}
              {answer.year ? ` (${answer.year})` : ""}
            </p>
            {answer.originalTitle !== answer.title && (
              <p className="text-xs text-text-muted">{answer.originalTitle}</p>
            )}
          </div>

          {/* Oyun bitince tüm kareler açıldı — hepsini küçük bir şerit olarak göster. */}
          {frames.length > 0 && (
            <div className="flex gap-1 overflow-x-auto">
              {frames.map((frame) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={frame}
                  src={getFrameUrl(frame)}
                  alt=""
                  className="h-14 w-24 shrink-0 rounded-md object-cover"
                />
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              {copied ? "Kopyalandı!" : "Paylaş"}
            </button>
            <button
              type="button"
              onClick={onHome}
              aria-label="Anasayfaya dön"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-card-hover text-text-main transition-colors hover:bg-card"
            >
              <Home className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

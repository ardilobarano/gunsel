"use client";

import { useState } from "react";
import { ArrowRight, Home, X } from "lucide-react";
import { cn, getTodayKey } from "@/lib/utils";

interface ResultModalProps {
  correctCount: number;
  maxSteps: number;
  roundResults: boolean[];
  onClose: () => void;
  onNext: () => void;
  isLastCategory: boolean;
}

export default function ResultModal({
  correctCount,
  maxSteps,
  roundResults,
  onClose,
  onNext,
  isLastCategory,
}: ResultModalProps) {
  const [copied, setCopied] = useState(false);
  const perfect = correctCount === maxSteps;

  function handleShare() {
    const squares = roundResults.map((result) => (result ? "🟩" : "🟥")).join("");
    const text = `Günsel Daha Az / Daha Çok ${getTodayKey()}\n${squares} ${correctCount}/${maxSteps}\nhttps://gunsel.app/daha-az-cok`;

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
        <div
          className={cn(
            "flex items-center justify-between px-5 py-4",
            perfect ? "bg-accent-green" : "bg-card-hover"
          )}
        >
          <h2 className={cn("text-lg font-bold", perfect ? "text-black" : "text-text-main")}>
            {perfect ? "Mükemmel! 🎉" : "Tamamlandı"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className={cn(
              "transition-colors",
              perfect ? "text-black/70 hover:text-black" : "text-text-muted hover:text-text-main"
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div className="rounded-lg border border-border-subtle bg-background px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Sonuç</p>
            <p className="mt-1 text-2xl font-bold text-text-main">
              {correctCount}/{maxSteps}
            </p>
          </div>

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
              onClick={onNext}
              aria-label={isLastCategory ? "Anasayfaya dön" : "Sonraki kategoriye geç"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-card-hover text-text-main transition-colors hover:bg-card"
            >
              {isLastCategory ? <Home className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

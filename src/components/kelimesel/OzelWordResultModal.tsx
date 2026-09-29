"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OzelWordResultModalProps {
  won: boolean;
  word: string;
  wordIndex: number;
  wordCount: number;
  onContinue: () => void;
}

/** Özel bulmacada ARADAKİ bir kelime bitince (doğru ya da deneme hakkı biterek) —
 * tüm bulmaca bitmiyor, günlük Kelimesel'deki gibi kısa bir sonuç gösterip
 * "Devam" ile bir sonraki kelimeye geçiliyor. */
export default function OzelWordResultModal({ won, word, wordIndex, wordCount, onContinue }: OzelWordResultModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onContinue}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-subtle bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-center justify-center px-5 py-4", won ? "bg-accent-green" : "bg-accent-red")}>
          <h2 className="text-lg font-bold text-black">{won ? "Doğru! 🎉" : "Bilemedin"}</h2>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div className="rounded-lg border border-border-subtle bg-background px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {wordIndex + 1}. kelime
            </p>
            <p className="mt-1 text-lg font-semibold text-text-main">{word}</p>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            {wordIndex + 1 < wordCount ? `${wordIndex + 2}. Kelimeye Geç` : "Devam Et"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

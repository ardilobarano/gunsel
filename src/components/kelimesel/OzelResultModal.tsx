"use client";

import { useState } from "react";
import Link from "next/link";
import { Home, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface OzelResultModalProps {
  status: "WON" | "LOST";
  revealedWords: string[] | null;
  shareCode: string;
  onClose: () => void;
}

export default function OzelResultModal({ status, revealedWords, shareCode, onClose }: OzelResultModalProps) {
  const [copied, setCopied] = useState(false);
  const won = status === "WON";

  function handleShare() {
    const url = `https://gunsel.app/kelimesel/ozel/${shareCode}`;
    navigator.clipboard.writeText(url).then(() => {
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
          className={cn("flex items-center justify-between px-5 py-4", won ? "bg-accent-green" : "bg-accent-red")}
        >
          <h2 className="text-lg font-bold text-black">{won ? "Tebrikler! 🎉" : "Oyun Bitti"}</h2>
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
          {!won && revealedWords && revealedWords.length > 0 && (
            <div className="rounded-lg border border-border-subtle bg-background px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {revealedWords.length > 1 ? "Kelimeler şuydu" : "Kelime şuydu"}
              </p>
              <p className="mt-1 text-lg font-semibold text-text-main">{revealedWords.join(" - ")}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              {copied ? "Kopyalandı!" : "Bulmacayı Paylaş"}
            </button>
            <Link
              href="/"
              aria-label="Anasayfaya dön"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-card-hover text-text-main transition-colors hover:bg-card"
            >
              <Home className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

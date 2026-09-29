"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import type { SolvedGroup } from "@/lib/baglamsal";
import { cn, getTodayKey } from "@/lib/utils";

const KARE = ["🟨", "🟩", "🟦", "🟪"];

export default function BaglamsalSonucModal({
  won,
  groups,
  mistakes,
  maxMistakes,
  onClose,
}: {
  won: boolean;
  groups: SolvedGroup[];
  mistakes: number;
  maxMistakes: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function share() {
    // Grupların ADI paylaşılmıyor — sadece zorluk renkleri. Aksi halde paylaşılan
    // sonuç arkadaşın bulmacasını bozardı (diğer oyunlardaki aynı kural).
    const satirlar = groups.map((g) => KARE[g.level].repeat(4)).join("\n");
    const text = `Günsel Bağlamsal ${getTodayKey()}\n${satirlar}\n${won ? `${mistakes} hatayla` : "Bulunamadı"}\nhttps://gunsel.app/baglamsal`;
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
        <div
          className={cn("flex items-center justify-between px-5 py-4", won ? "bg-accent-green" : "bg-accent-red")}
        >
          <h2 className="text-lg font-bold text-black">{won ? "Tamamladın!" : "Olmadı"}</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="text-black">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-5">
          <p className="text-center text-sm text-text-muted">
            {won ? `${mistakes}/${maxMistakes} hata ile bitirdin` : "Hata hakkın bitti"}
          </p>

          <button
            type="button"
            onClick={share}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black"
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

"use client";

import { X } from "lucide-react";
import { LEVEL_COLORS, MAX_MISTAKES } from "@/lib/baglamsal";

const ZORLUK = ["En kolay", "Kolay", "Zor", "En zor"];

export default function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border-subtle bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-bold text-text-main">Nasıl Oynanır?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="text-text-muted transition-colors hover:text-text-main"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 pb-5">
          <p className="text-sm text-text-muted">
            On altı kelime var. Bunları ortak bir bağı olan dörder kelimelik dört gruba ayır.
          </p>

          <ul className="flex flex-col gap-2 text-sm text-text-main">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-base">👆</span>
              <span>Dört kelime seç ve Gönder&apos;e bas.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-base">💡</span>
              <span>
                Üçü doğruysa <strong>&quot;Bir tane eksik!&quot;</strong> uyarısı gelir.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-base">❌</span>
              <span>{MAX_MISTAKES} hata hakkın var; bitince bulmaca kapanır.</span>
            </li>
          </ul>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
              Grupların zorluğu
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-text-main">
              {LEVEL_COLORS.map((renk, i) => (
                <li key={renk} className="flex items-center gap-3">
                  <span className="h-4 w-8 shrink-0 rounded-sm" style={{ background: renk }} />
                  <span>{ZORLUK[i]}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Oyunun asıl zorluğu bu; söylemezsek haksız görünüyor. */}
          <p className="text-xs leading-relaxed text-text-muted">
            Dikkat: bazı kelimeler birden fazla gruba aitmiş gibi görünür. Bir kategori
            beş üyeliymiş gibi duruyorsa, biri başka gruba aittir.
          </p>
        </div>
      </div>
    </div>
  );
}

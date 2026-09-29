"use client";

import { X } from "lucide-react";

interface HowToPlayModalProps {
  onClose: () => void;
}

export default function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-subtle bg-card"
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
            İlk turda iki değer de gizlidir — hangisinin daha büyük olduğunu düşünüyorsan o karta dokun.
          </p>

          <div className="flex items-stretch gap-2">
            <div className="flex-1 rounded-xl border-2 border-border-subtle bg-card-hover px-3 py-3 text-center">
              <p className="text-sm font-medium text-text-main">İstanbul</p>
              <p className="mt-1 text-lg font-bold text-text-muted">?</p>
            </div>
            <div className="flex-1 rounded-xl border-2 border-border-subtle bg-card px-3 py-3 text-center">
              <p className="text-sm font-medium text-text-main">Paris</p>
              <p className="mt-1 text-lg font-bold text-text-muted">?</p>
            </div>
          </div>

          <p className="text-sm text-text-muted">
            Doğru bilirsen o kart yeşile döner, yanlış bilirsen kırmızıya — ama oyun bitmez, gerçek değerler
            açığa çıkıp sıradaki karta geçilir. Seçtiğin/açığa çıkan değer soldaki bilinen kart olarak kalır,
            bir sonraki tur onu yeni bir gizemli değerle karşılaştırırsın. 5 karşılaştırma sonunda kaç
            tanesini doğru bildiğin gösterilir.
          </p>

          <p className="text-sm text-text-muted">
            6 kategori var: Nüfus, Film, Dizi, İzlenme, Fiyat ve Trivia — her biri kendi günlük turuna sahip.
          </p>
        </div>
      </div>
    </div>
  );
}

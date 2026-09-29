"use client";

import { Play, X } from "lucide-react";

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
            Kısa bir parça dinle, şarkıyı tahmin et. Yanlış tahminler süreyi uzatıp daha fazlasını açar.
          </p>

          <div className="flex h-3 w-full gap-1">
            <div className="h-full flex-[2] rounded-sm bg-accent-green" />
            <div className="h-full flex-[3] rounded-sm bg-zinc-600" />
            <div className="h-full flex-[5] rounded-sm bg-card-hover ring-1 ring-text-muted" />
            <div className="h-full flex-[10] rounded-sm bg-card" />
          </div>

          <div className="flex items-center gap-3 text-sm text-text-main">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-green text-black">
              <Play className="ml-0.5 h-4 w-4" />
            </span>
            Mevcut parçayı çal.
          </div>

          <ul className="flex flex-col gap-2 text-sm text-text-main">
            <li className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-md bg-accent-red" />
              Yanlış sanatçı ve şarkı.
            </li>
            <li className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-md bg-accent-yellow" />
              Sanatçı doğru, şarkı yanlış.
            </li>
            <li className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-md bg-accent-green" />
              Buldun!
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

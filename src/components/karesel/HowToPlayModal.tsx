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
            Günün yapımını tek bir kareden tahmin et. 6 tahmin hakkın var. İki sekme var: Film ve Dizi, her birinin günlük yapımı ayrı.
          </p>

          <ul className="flex flex-col gap-2 text-sm text-text-main">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-6 shrink-0 rounded-md bg-card-hover text-center text-xs font-bold leading-5 text-text-main">
                1
              </span>
              İlk kare en zor olanı — tanınması güç bir an.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-6 shrink-0 rounded-md bg-card-hover text-center text-xs font-bold leading-5 text-text-main">
                6
              </span>
              Her yanlış tahminde ya da pas geçtiğinde yeni bir kare açılır, kareler gittikçe tanıdıklaşır.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-6 shrink-0 rounded-md bg-accent-green text-center text-xs font-bold leading-5 text-black">
                ✓
              </span>
              Ne kadar az kareyle bilirsen o kadar iyi.
            </li>
          </ul>

          <p className="text-center text-xs text-text-muted">
            Açılan kareler arasında oklarla ileri geri gezebilirsin.
          </p>
        </div>
      </div>
    </div>
  );
}

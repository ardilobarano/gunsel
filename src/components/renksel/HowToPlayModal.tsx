"use client";

import { X } from "lucide-react";
import { TUR_PUANI } from "@/lib/renksel";

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
            Görseldeki bir bölgenin rengi silindi. O bölgenin gerçek rengini hatırlayıp
            kaydırıcılarla bulmaya çalış — seçtiğin renk görselin üstünde anında görünüyor.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Kurallar</p>
            <ul className="flex flex-col gap-2 text-sm text-text-main">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-base">🎨</span>
                <span>Her gün tek soru</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-base">☝️</span>
                <span>Her soruda tek hak — onayladıktan sonra değiştiremezsin</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-base">🔢</span>
                <span>Sonuç {TUR_PUANI} üzerinden puanlanır</span>
              </li>
            </ul>
          </div>

          <p className="text-xs text-text-muted">
            Puan, seçtiğin rengin doğrusuna gözle ne kadar yakın olduğuna göre veriliyor — tam
            tutturmak şart değil, yakın olmak da kazandırıyor.
          </p>
        </div>
      </div>
    </div>
  );
}

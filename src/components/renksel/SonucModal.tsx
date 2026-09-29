"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { puanKaresi, TUR_PUANI, type RenkselSonuc } from "@/lib/renksel";
import { getTodayKey } from "@/lib/utils";

export default function SonucModal({
  sonuclar,
  puan,
  onClose,
}: {
  sonuclar: RenkselSonuc[];
  puan: number;
  onClose: () => void;
}) {
  const [kopyalandi, setKopyalandi] = useState(false);

  function paylas() {
    /* Kareler puanı gösteriyor ama RENKLERİ ele vermiyor — paylaşılan sonuç
       arkadaşın bulmacasını bozmasın diye (diğer oyunlardaki aynı kural). */
    const kareler = sonuclar.map((s) => puanKaresi(s.puan)).join("");
    const metin = `Günsel Renksel ${getTodayKey()}\n${kareler} ${puan.toFixed(1)}/${TUR_PUANI}\nhttps://gunsel.app/renksel`;
    navigator.clipboard.writeText(metin).then(() => {
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1800);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border-subtle bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-accent-green px-5 py-4">
          <h2 className="text-lg font-bold text-black">
            {puan.toFixed(1)} / {TUR_PUANI}
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="text-black">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-5">
          {/* Her turda TAHMİN ve DOĞRU yan yana: oyunun öğretici tarafı bu,
              "ne kadar yanılmışım" ancak ikisi bitişikken görülüyor. */}
          {sonuclar.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-8 flex-1 rounded-md border border-border-subtle" style={{ background: s.tahmin }} />
              <span className="h-8 flex-1 rounded-md border border-border-subtle" style={{ background: s.dogru }} />
              <span className="w-10 shrink-0 text-right text-sm font-semibold text-text-main">
                {s.puan.toFixed(1)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span className="flex-1 text-center">senin</span>
            <span className="flex-1 text-center">doğrusu</span>
            <span className="w-10 shrink-0" />
          </div>

          <button
            type="button"
            onClick={paylas}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black"
          >
            {kopyalandi ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {kopyalandi ? "Kopyalandı" : "Sonucu paylaş"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

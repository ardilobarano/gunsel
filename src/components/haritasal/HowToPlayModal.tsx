"use client";

import { X } from "lucide-react";
import { heatLevels, MAX_ATTEMPTS } from "@/lib/haritasal";

const DUNYA = heatLevels("dunya");
const ILLER = heatLevels("iller");

/** Eşikleri kısa aralık metnine çevirir ("<1.000", "1.000–3.000", ">13.000").
 *  Pencere dar olduğu için "km" hücrede değil sütun başlığında yazıyor. */
function araligiYaz(seviyeler: readonly { maxKm: number }[], index: number): string {
  const alt = index === 0 ? 0 : seviyeler[index - 1].maxKm;
  const ust = seviyeler[index].maxKm;
  if (ust === Infinity) return `>${alt.toLocaleString("tr-TR")}`;
  if (alt === 0) return `<${ust.toLocaleString("tr-TR")}`;
  return `${alt.toLocaleString("tr-TR")}–${ust.toLocaleString("tr-TR")}`;
}

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
            Ekrandaki siluetin hangi ülkeye ya da ile ait olduğunu bul. {MAX_ATTEMPTS} tahmin hakkın var.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
              Her tahminden sonra
            </p>
            <ul className="flex flex-col gap-2 text-sm text-text-main">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-base">📏</span>
                <span>Doğru cevaba olan kuş uçuşu mesafe</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-base">➡️</span>
                <span>Doğru cevabın hangi yönde kaldığı</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-base">🔥</span>
                <span>Ne kadar yakın olduğunu gösteren sıcaklık</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Sıcaklık</p>
            {/* İki sekmenin eşikleri farklı ve fark BÜYÜK: Türkiye'nin iki ucu
                arası 1.580 km, yani dünya ölçeği illerde tek kademeye sıkışırdı.
                O yüzden iki sütun yan yana gösteriliyor. */}
            <ul className="flex flex-col gap-1.5 text-sm text-text-main">
              <li className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                <span className="w-6 shrink-0" />
                <span className="flex-1" />
                <span className="w-[5.25rem] shrink-0 text-right">Dünya km</span>
                <span className="w-[4.25rem] shrink-0 text-right">İller km</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-base">🎯</span>
                <span className="flex-1">Doğru cevap</span>
              </li>
              {DUNYA.map((seviye, i) => (
                <li key={seviye.emoji} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-base">{seviye.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {i === DUNYA.length - 1 ? "En uzak" : seviye.label}
                  </span>
                  <span className="w-[5.25rem] shrink-0 text-right text-xs text-text-muted">
                    {araligiYaz(DUNYA, i)}
                  </span>
                  <span className="w-[4.25rem] shrink-0 text-right text-xs text-text-muted">
                    {araligiYaz(ILLER, i)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-text-muted">
            İki sekme var: Dünya Ülkeleri ve Türkiye İlleri. Her gün her sekmede yeni bir
            siluet ve herkes aynı gün aynı siluetle oynar.
          </p>
        </div>
      </div>
    </div>
  );
}

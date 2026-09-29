"use client";

import { cn } from "@/lib/utils";

// Düz-üst (flat-top) altıgen: sivri uçlar solda/sağda, düz kenarlar üstte/altta.
// Komşu altıgenler bu düz kenarlardan (üst/alt) ve 4 eğik kenardan değiyor —
// bu yüzden merkez etrafındaki 6 harf de üst/alt + 4 çapraz konumda olmalı.
const HEX_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

// Düzgün bir düz-üst altıgende genişlik = yükseklik * 2/√3 (yükseklikten daha geniş).
// Kap yüzdesi cinsinden: yükseklik sabit, genişlik buna göre hesaplanıyor.
const HEX_HEIGHT_PCT = 29;
const HEX_WIDTH_PCT = HEX_HEIGHT_PCT * (2 / Math.sqrt(3));

// Komşu merkezlerinin mesafesi altıgenin YÜKSEKLİĞİNDEN BÜYÜK tutuluyor; aradaki fark
// kadar boşluk kalıyor ve koyu arkaplan aralardan görünerek her altıgenin kenarını
// belirginleştiriyor. Eşit olsaydı altıgenler birbirine yapışırdı — dış altıgenlerin
// altısı da aynı renkte olduğu için tek bir gri kütle gibi görünüyorlardı.
// (clip-path kullanıldığı için border çare değil: kenarlık da kırpılıyor.)
const NEIGHBOR_DISTANCE_PCT = 32;
const OUTER_ANGLES_DEG = [0, 60, 120, 180, 240, 300];
const OUTER_POSITIONS = OUTER_ANGLES_DEG.map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return {
    top: `${50 - NEIGHBOR_DISTANCE_PCT * Math.cos(rad)}%`,
    left: `${50 + NEIGHBOR_DISTANCE_PCT * Math.sin(rad)}%`,
  };
});

interface HiveProps {
  centerLetter: string;
  outerLetters: string[];
  onLetterClick: (letter: string) => void;
}

export default function Hive({ centerLetter, outerLetters, onLetterClick }: HiveProps) {
  const hexStyle = { width: `${HEX_WIDTH_PCT}%`, height: `${HEX_HEIGHT_PCT}%` };

  return (
    /* Küçük ekranda petek küçültülüyor — 256px sabit boyut sayfanın taşmasına
       katkıda bulunuyordu. */
    <div className="relative mx-auto h-52 w-52 sm:h-72 sm:w-72">
      <button
        type="button"
        onClick={() => onLetterClick(centerLetter)}
        style={{ clipPath: HEX_CLIP, top: "50%", left: "50%", ...hexStyle }}
        className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-accent-yellow text-2xl font-bold text-black transition-transform hover:scale-105 sm:text-3xl"
      >
        {centerLetter}
      </button>

      {outerLetters.map((letter, i) => (
        <button
          key={`${letter}-${i}`}
          type="button"
          onClick={() => onLetterClick(letter)}
          style={{ clipPath: HEX_CLIP, ...OUTER_POSITIONS[i], ...hexStyle }}
          className={cn(
            "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center",
            "bg-card-hover text-2xl font-bold text-text-main transition-transform hover:scale-105 sm:text-3xl"
          )}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}

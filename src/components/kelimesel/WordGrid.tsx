"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { LetterStatus } from "@/lib/kelimesel";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

interface WordGridProps {
  length: number;
  maxAttempts: number;
  guesses: string[];
  evaluations: LetterStatus[][];
  /** Bileşen mount olduğunda localStorage'da zaten kayıtlı olan tahmin sayısı —
   * bu satırlar "yeniden gösteriliyor", canlı tahmin edilmiyor; ses çalmaz ve
   * çevirme yerine sade/senkron bir beliriş animasyonu kullanır. */
  initialGuessCount: number;
  currentGuess: string;
  shakeToken: number;
}

/** Kutular arası boşluk (px) — hem satır içi hem satırlar arası. */
const GAP = 6;
/** Masaüstünde kutular gereğinden fazla büyümesin (eski sm:h-14 = 56px ile aynı). */
const MAX_TILE = 56;
const MIN_TILE = 24;

/**
 * Kutu boyutunu KALAN ALANA göre hesaplar.
 *
 * Neden JS: sabit 48px kutularla sayfa iPhone'da ekrana sığmıyordu (iPhone 13'te 169px,
 * SE'de 265px taşıyor, oynarken kaydırmak gerekiyordu). Saf CSS ile denendi —
 * `aspect-ratio` + açık width/height birbiriyle çakışıp kutuları 57x25 gibi yamuk
 * bıraktı. Ölçüp hesaplamak hem kesin hem her ekranda doğru sonuç veriyor.
 *
 * setState effect gövdesinde SENKRON çağrılmıyor (projenin react-hooks kuralı);
 * ResizeObserver ilk gözlemi kendisi tetiklediği için ilk ölçüm de oradan geliyor.
 */
function useTileSize(length: number, maxAttempts: number) {
  const [tileSize, setTileSize] = useState(MAX_TILE);
  const elRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(
    (el: HTMLDivElement) => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const byHeight = (height - GAP * (maxAttempts - 1)) / maxAttempts;
      const byWidth = (width - GAP * (length - 1)) / length;
      const next = Math.floor(Math.min(byHeight, byWidth));
      setTileSize(Math.max(MIN_TILE, Math.min(MAX_TILE, next)));
    },
    [length, maxAttempts]
  );

  /**
   * Ölçüm ref callback'inde yapılıyor: React bunu DOM'a yazdıktan SONRA ama tarayıcı
   * BOYAMADAN önce çalıştırıyor, dolayısıyla yanlış boyutla bir kare çizilip sonra
   * düzeltilmiyor. Önce effect içindeydi ve efektler boyamadan sonra çalıştığı için
   * kutular 56px çizilip ardından gerçek boyuta küçülüyordu — harf sayısı değişince
   * (key ile remount olduğu için) bu "büyüyüp sonra yerine oturma" olarak görünüyordu.
   */
  const wrapRef = useCallback(
    (el: HTMLDivElement | null) => {
      elRef.current = el;
      if (el) measure(el);
    },
    [measure]
  );

  // Ekran döndürme / pencere yeniden boyutlandırma için canlı takip.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => measure(el));
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return { wrapRef, tileSize };
}

const STATUS_CLASSES: Record<LetterStatus, string> = {
  correct: "border-accent-green bg-accent-green text-black",
  present: "border-accent-yellow bg-accent-yellow text-black",
  absent: "border-border-subtle bg-card-hover text-text-muted",
};

interface Row {
  letters: string[];
  evaluation: LetterStatus[] | null;
  active: boolean;
  isHistorical: boolean;
}

export default function WordGrid({
  length,
  maxAttempts,
  guesses,
  evaluations,
  initialGuessCount,
  currentGuess,
  shakeToken,
}: WordGridProps) {
  const { wrapRef, tileSize } = useTileSize(length, maxAttempts);

  const rows: Row[] = Array.from({ length: maxAttempts }, (_, rowIndex) => {
    if (rowIndex < guesses.length) {
      return {
        letters: guesses[rowIndex].split(""),
        evaluation: evaluations[rowIndex],
        active: false,
        isHistorical: rowIndex < initialGuessCount,
      };
    }
    if (rowIndex === guesses.length) {
      return {
        letters: Array.from({ length }, (_, i) => currentGuess[i] ?? ""),
        evaluation: null,
        active: true,
        isHistorical: false,
      };
    }
    return { letters: Array.from({ length }, () => ""), evaluation: null, active: false, isHistorical: false };
  });

  return (
    <div ref={wrapRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div className="flex flex-col" style={{ gap: GAP }}>
        {rows.map((row, rowIndex) => (
          <GridRow
            key={rowIndex}
            letters={row.letters}
            evaluation={row.evaluation}
            isHistorical={row.isHistorical}
            shakeToken={row.active ? shakeToken : 0}
            tileSize={tileSize}
          />
        ))}
      </div>
    </div>
  );
}

function GridRow({
  letters,
  evaluation,
  isHistorical,
  shakeToken,
  tileSize,
}: {
  letters: string[];
  evaluation: LetterStatus[] | null;
  isHistorical: boolean;
  shakeToken: number;
  tileSize: number;
}) {
  return (
    <motion.div
      className="flex justify-center"
      style={{ gap: GAP }}
      animate={shakeToken > 0 ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
    >
      {letters.map((letter, i) => (
        <Tile
          key={`${i}-${letter}-${evaluation?.[i] ?? ""}`}
          letter={letter}
          status={evaluation?.[i]}
          delay={i * 0.2}
          isHistorical={isHistorical}
          tileSize={tileSize}
        />
      ))}
    </motion.div>
  );
}

function Tile({
  letter,
  status,
  delay,
  isHistorical,
  tileSize,
}: {
  letter: string;
  status?: LetterStatus;
  delay: number;
  isHistorical: boolean;
  tileSize: number;
}) {
  const isLiveReveal = !!status && !isHistorical;

  // Sadece bu oturumda CANLI olarak gönderilen tahminler ses çalar/çevirir —
  // sayfa yüklenirken localStorage'dan gelen (zaten görülmüş) satırlar sessiz,
  // sade bir beliriş animasyonuyla gösterilir.
  useEffect(() => {
    if (!letter || isHistorical) return;
    const soundDelay = status ? delay : 0;
    const timer = setTimeout(() => {
      playSound(status ? "revealFlip" : "keyTap");
    }, soundDelay * 1000);
    return () => clearTimeout(timer);
  }, [letter, status, delay, isHistorical]);

  const initial = !letter
    ? false
    : isHistorical
      ? { opacity: 0, scale: 0.92 }
      : isLiveReveal
        ? { rotateX: -90, opacity: 0 }
        : { scale: 0.7, opacity: 0 };

  const animate = isLiveReveal
    ? { rotateX: 0, opacity: 1 }
    : { scale: 1, opacity: 1 };

  const transition = isHistorical
    ? { duration: 0.2, delay: 0 }
    : isLiveReveal
      ? { duration: 0.3, delay }
      : { duration: 0.15, delay: 0 };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      style={{
        transformStyle: "preserve-3d",
        width: tileSize,
        height: tileSize,
        // Yazı da kutuyla birlikte küçülsün — kutunun ~%45'i okunaklı bir oran.
        fontSize: Math.round(tileSize * 0.45),
      }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border-2 font-bold uppercase",
        status
          ? STATUS_CLASSES[status]
          : letter
            ? "border-text-muted text-text-main"
            : "border-border-subtle text-text-main"
      )}
    >
      {letter}
    </motion.div>
  );
}

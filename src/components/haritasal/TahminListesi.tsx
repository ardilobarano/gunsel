"use client";

import { bearingToArrow, heatFor, type HaritasalGuessEntry } from "@/lib/haritasal";
import { cn } from "@/lib/utils";

/** Her satır: tahmin + mesafe + yön oku + yakınlık yüzdesi.
 *  Yakınlık, oyuncunun "sıcak mı soğuk mu" hissini tek bakışta almasını sağlıyor. */
export default function TahminListesi({
  guesses,
  maxAttempts,
  kategoriId,
}: {
  guesses: HaritasalGuessEntry[];
  maxAttempts: number;
  /** Sicaklik esikleri sekmeye gore degisiyor (bkz. lib/haritasal.ts). */
  kategoriId: string;
}) {
  const bosSatir = Math.max(0, maxAttempts - guesses.length);

  return (
    <div className="flex w-full flex-col gap-1.5">
      {guesses.map((g, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            g.correct
              ? "border-accent-green bg-accent-green text-black"
              : "border-border-subtle bg-card text-text-main"
          )}
        >
          <span className="min-w-0 flex-1 truncate font-semibold">{g.label}</span>
          {/* Kilometre GÖSTERİLMİYOR: emojiyle yan yana aynı bilgiyi iki kez verip
              emojiyi süse çeviriyordu. Kalan iki ipucu yön ve sıcaklık. */}
          <span className="shrink-0 text-base leading-none">{bearingToArrow(g.bearing)}</span>
          <span className="shrink-0 text-lg leading-none" title={heatFor(g, kategoriId).label}>
            {heatFor(g, kategoriId).emoji}
          </span>
          <span className="w-20 shrink-0 text-right text-xs text-text-muted">{heatFor(g, kategoriId).label}</span>
        </div>
      ))}

      {Array.from({ length: bosSatir }, (_, i) => (
        <div
          key={`bos-${i}`}
          className="h-[38px] rounded-lg border border-dashed border-border-subtle"
        />
      ))}
    </div>
  );
}

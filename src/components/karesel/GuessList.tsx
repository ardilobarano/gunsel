"use client";

import { formatMovieLabel, type MovieGuessEntry } from "@/lib/karesel";
import { cn } from "@/lib/utils";

interface GuessListProps {
  rows: MovieGuessEntry[];
  maxAttempts: number;
  won: boolean;
}

export default function GuessList({ rows, maxAttempts, won }: GuessListProps) {
  const slots = Array.from({ length: maxAttempts }, (_, i) => rows[i]);

  return (
    <div className="flex w-full flex-col gap-2">
      {slots.map((row, i) => {
        const isWinningRow = won && i === rows.length - 1 && row && !row.skipped;

        return (
          <div
            key={i}
            className={cn(
              // Küçük ekranda satırlar kısaltılıyor (Şarkısal'daki gibi) — 6 satır
              // tek başına ~264px yer kaplayıp sayfanın taşmasına yol açıyordu.
              "flex h-9 items-center justify-center truncate rounded-lg border px-2 text-xs font-semibold sm:h-11 sm:px-3 sm:text-sm",
              isWinningRow
                ? "border-accent-green bg-accent-green text-black"
                : row
                  ? "border-border-subtle bg-card-hover text-text-main"
                  : "border-dashed border-border-subtle text-text-muted"
            )}
          >
            {row
              ? row.skipped
                ? "Pas Geçildi"
                : isWinningRow
                  ? `Tebrikler! ${formatMovieLabel(row.title ?? "", row.year)}`
                  : formatMovieLabel(row.title ?? "", row.year)
              : ""}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";

interface GuessRow {
  skipped: boolean;
  title?: string;
  artist?: string;
  artistMatch?: boolean;
}

interface GuessListProps {
  rows: GuessRow[];
  maxAttempts: number;
  won: boolean;
}

export default function GuessList({ rows, maxAttempts, won }: GuessListProps) {
  const slots = Array.from({ length: maxAttempts }, (_, i) => rows[i]);

  return (
    <div className="flex w-full flex-col gap-1.5 sm:gap-2">
      {slots.map((row, i) => {
        const isLast = i === rows.length - 1;
        const isWinningRow = won && isLast && row && !row.skipped;
        const isArtistHint = !isWinningRow && row && !row.skipped && row.artistMatch;

        return (
          <div
            key={i}
            className={cn(
              // Küçük ekranda satırlar kısaltılıyor: 6 satır × 44px tek başına 264px
              // yer kaplayıp sayfanın taşmasına yol açıyordu.
              "flex h-9 items-center justify-center rounded-lg border px-2 text-center text-xs font-semibold sm:h-11 sm:text-sm",
              isWinningRow
                ? "border-accent-green bg-accent-green text-black"
                : isArtistHint
                  ? "border-accent-yellow bg-accent-yellow text-black"
                  : row
                    ? "border-border-subtle bg-card-hover text-text-main"
                    : "border-dashed border-border-subtle text-text-muted"
            )}
          >
            {row
              ? row.skipped
                ? "Pas Geçildi"
                : isWinningRow
                  ? `Tebrikler! ${row.title} - ${row.artist}`
                  : `${row.title} - ${row.artist}`
              : ""}
          </div>
        );
      })}
    </div>
  );
}

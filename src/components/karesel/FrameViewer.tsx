"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getFrameUrl } from "@/lib/karesel";
import { cn } from "@/lib/utils";

interface FrameViewerProps {
  frames: string[];
  /** Oyun sürerken en son açılan kare; oyun bitince tüm kareler gezilebilir. */
  currentIndex: number;
  maxAttempts: number;
  loading?: boolean;
}

export default function FrameViewer({ frames, currentIndex, maxAttempts, loading }: FrameViewerProps) {
  // Kullanıcı açılmış kareler arasında geri dönüp bakabilsin (Framed'de de var) —
  // yeni bir kare açılınca otomatik ona atlaması için currentIndex'i takip ediyoruz.
  const [viewIndex, setViewIndex] = useState(currentIndex);
  const [syncedTo, setSyncedTo] = useState(currentIndex);

  if (syncedTo !== currentIndex) {
    setSyncedTo(currentIndex);
    setViewIndex(currentIndex);
  }

  const safeIndex = Math.min(Math.max(viewIndex, 0), Math.max(frames.length - 1, 0));
  const frame = frames[safeIndex];

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border-subtle bg-card">
        {loading || !frame ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-text-muted">
            Yükleniyor…
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={frame} src={getFrameUrl(frame)} alt="Film karesi" className="h-full w-full object-cover" />
        )}

        {frames.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setViewIndex(safeIndex - 1)}
              disabled={safeIndex === 0}
              aria-label="Önceki kare"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewIndex(safeIndex + 1)}
              disabled={safeIndex >= frames.length - 1}
              aria-label="Sonraki kare"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Kare göstergesi: açılanlar dolu, açılmayanlar boş. */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: maxAttempts }, (_, i) => {
          const unlocked = i < frames.length;
          return (
            <button
              key={i}
              type="button"
              disabled={!unlocked}
              onClick={() => setViewIndex(i)}
              aria-label={`${i + 1}. kare`}
              className={cn(
                "h-2 rounded-full transition-all",
                i === safeIndex ? "w-6 bg-accent-green" : "w-2",
                i !== safeIndex && (unlocked ? "bg-text-muted" : "bg-card cursor-not-allowed")
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

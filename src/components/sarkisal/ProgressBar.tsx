"use client";

import { MAX_SECONDS, STAGE_SECONDS } from "@/lib/sarkisal";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  stageIndex: number;
  wonStageIndex: number | null;
  /** Oynatma sırasında geçen saniye (0'dan mevcut aşamanın süresine kadar) —
   * video/audio player'daki gibi gerçek zamanlı ilerleyen bir dolgu çizmek için. */
  playbackSeconds?: number;
}

const DELTAS = STAGE_SECONDS.map((seconds, i) => (i === 0 ? seconds : seconds - STAGE_SECONDS[i - 1]));

function formatSeconds(seconds: number): string {
  return `${seconds} saniye`;
}

export default function ProgressBar({ stageIndex, wonStageIndex, playbackSeconds = 0 }: ProgressBarProps) {
  const pointerLeft = (STAGE_SECONDS[stageIndex] / MAX_SECONDS) * 100;

  return (
    <div className="w-full">
      <div className="relative mb-1 h-10">
        {/* Yazı ve ok AYRI konumlanıyor. Yazı geniş olduğu için kendi genişliğinin
            yarısı kadar sola kaydırılınca ilk aşamada (0.2sn -> %2) ekranın solundan
            taşıyordu; clamp ile kenarlardan içeride tutuluyor. Ok ise dar olduğundan
            taşmıyor ve GERÇEK konumunda bırakılıyor — yoksa yanlış segmenti gösteriyor. */}
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-text-main"
          style={{ left: `clamp(2.25rem, ${pointerLeft}%, calc(100% - 2.25rem))` }}
        >
          {formatSeconds(STAGE_SECONDS[stageIndex])}
        </span>
        <span
          className="absolute bottom-0 -translate-x-1/2 text-text-main"
          style={{ left: `${pointerLeft}%` }}
        >
          ▾
        </span>
      </div>

      <div className="flex h-3 w-full gap-1">
        {STAGE_SECONDS.map((seconds, i) => {
          const isWon = wonStageIndex === i;
          const isPassed = i < stageIndex;
          const isCurrent = i === stageIndex;

          // Klip her zaman şarkının başından çaldığı için, çalarken dolgu tüm
          // geçilmiş kutuların üzerinden sırayla süpürüyor — ama her kutunun dolgusu
          // kendi kutusunun içinde hesaplanıyor (0-100%), böylece kutular arasındaki
          // boşluk (gap-1) hiç boyanmıyor, segmentli görünüm bozulmuyor.
          const segmentStart = i === 0 ? 0 : STAGE_SECONDS[i - 1];
          const segmentFillPercent = Math.min(
            100,
            Math.max(0, ((playbackSeconds - segmentStart) / DELTAS[i]) * 100)
          );

          return (
            <div
              key={seconds}
              style={{ flexGrow: DELTAS[i] }}
              className={cn(
                // segment: Pop görünümünde kontur alıyor — açık zeminde konturuz
                // kutular görünmez oluyordu. Klasik görünümde etkisi yok.
                "segment relative h-full overflow-hidden rounded-sm transition-colors",
                isWon
                  ? "bg-accent-green"
                  : isPassed
                    ? "bg-zinc-600"
                    : isCurrent
                      ? "bg-card-hover ring-1 ring-text-muted"
                      : "bg-card"
              )}
            >
              {segmentFillPercent > 0 && (
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 bg-accent-green/70"
                  style={{ width: `${segmentFillPercent}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

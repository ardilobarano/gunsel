"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Home, X } from "lucide-react";
import type { LetterStatus } from "@/lib/kelimesel";
import { cn, getTodayKey } from "@/lib/utils";

interface ResultModalProps {
  status: "WON" | "LOST";
  length: number;
  date: string;
  revealedWord: string | null;
  evaluations: LetterStatus[][];
  /** Gerçek tahmin sayısı — başka cihazda bitirilmiş bir gün için evaluations boş
   *  kalabildiğinden (bkz. useKelimesel'deki initialAttempts), çağıran taraf bunu
   *  paylaşım ızgarası boşsa bile doğru "X adımda çözüldü" göstermek için hesaplar. */
  guessCount: number;
  maxAttempts: number;
  onClose: () => void;
  onNext: () => void;
  isLastLength: boolean;
}

interface DailyStats {
  wins: number[];
  losses: number;
  average: number | null;
  total: number;
}

const STATUS_EMOJI: Record<LetterStatus, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
};

export default function ResultModal({
  status,
  length,
  date,
  revealedWord,
  evaluations,
  guessCount,
  maxAttempts,
  onClose,
  onNext,
  isLastLength,
}: ResultModalProps) {
  const [copied, setCopied] = useState(false);
  const won = status === "WON";

  // Günün bulmacasında TÜM oyuncuların dağılımı — /api/kelimesel/guess bu oyunu bitiren
  // her isteğin sonunda bir DailyResult satırı yazıyor, kendi geçmişimiz değil.
  const [stats, setStats] = useState<DailyStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/kelimesel/stats?date=${date}&length=${length}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DailyStats | null) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [date, length]);

  const wins = stats?.wins ?? new Array(maxAttempts).fill(0);
  const losses = stats?.losses ?? 0;
  const total = stats?.total ?? 0;
  const topPercent =
    won && total > 1
      ? Math.round((wins.slice(0, guessCount).reduce((a, b) => a + b, 0) / total) * 1000) / 10
      : null;

  function handleShare() {
    const grid = evaluations.map((row) => row.map((letterStatus) => STATUS_EMOJI[letterStatus]).join("")).join("\n");
    const resultLabel = won ? `${guessCount}/${maxAttempts}` : `X/${maxAttempts}`;
    const text = `Günsel Kelimesel ${length} Harf ${getTodayKey()}\n${resultLabel}\n${grid}\nhttps://gunsel.app/kelimesel`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-subtle bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div
            className={cn(
              "flex items-center justify-between px-5 py-4",
              won ? "bg-accent-green" : "bg-accent-red"
            )}
          >
            <h2 className="text-lg font-bold text-black">{won ? "Kazandın! 🎉" : "Oyun Bitti"}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="text-black/70 transition-colors hover:text-black"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="absolute -bottom-3 left-4 rounded-md border border-border-subtle bg-card-hover px-3 py-1 text-xs font-semibold text-text-main shadow-sm">
            {length} Harfli
          </div>
        </div>

        <div className="flex flex-col gap-5 p-5 pt-7">
          <div className="grid grid-cols-2 gap-3">
            {won ? (
              <StatBox value={String(guessCount)} caption="adımda çözüldü." />
            ) : (
              <StatBox label="Kelime Şuydu" value={revealedWord ?? "-"} />
            )}
            <StatBox label="Ortalama" value={stats?.average != null ? stats.average.toFixed(2) : "-"} />
          </div>

          <GuessDistributionChart
            wins={wins}
            losses={losses}
            highlightIndex={won ? guessCount - 1 : null}
            highlightLoss={!won}
          />

          {topPercent !== null && (
            <p className="text-center text-sm text-text-muted">
              Bugün oyuncuların en iyi <span className="font-semibold text-text-main">%{topPercent}</span>&apos;i
              arasındasın.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              {copied ? "Kopyalandı!" : "Paylaş"}
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label={isLastLength ? "Anasayfaya dön" : "Sonraki harf sayısına geç"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-card-hover text-text-main transition-colors hover:bg-card"
            >
              {isLastLength ? <Home className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, caption }: { label?: string; value: string; caption?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-background px-4 py-3 text-center">
      {label && <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>}
      <p className={cn("text-2xl font-bold text-text-main", label && "mt-1")}>{value}</p>
      {caption && <p className="mt-1 text-xs text-text-muted">{caption}</p>}
    </div>
  );
}

function GuessDistributionChart({
  wins,
  losses,
  highlightIndex,
  highlightLoss,
}: {
  wins: number[];
  losses: number;
  highlightIndex: number | null;
  highlightLoss: boolean;
}) {
  const maxCount = Math.max(...wins, losses, 1);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Tahmin Dağılımı</p>
      {wins.map((count, i) => (
        <DistributionRow key={i} label={String(i + 1)} count={count} maxCount={maxCount} highlighted={highlightIndex === i} />
      ))}
      <DistributionRow label="X" count={losses} maxCount={maxCount} highlighted={highlightLoss} />
    </div>
  );
}

function DistributionRow({
  label,
  count,
  maxCount,
  highlighted,
}: {
  label: string;
  count: number;
  maxCount: number;
  highlighted: boolean;
}) {
  const widthPercent = Math.max(count > 0 ? 8 : 4, (count / maxCount) * 100);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 shrink-0 text-text-muted">{label}</span>
      <div
        className={cn(
          "flex h-5 items-center justify-end rounded-sm px-1.5 text-[11px] font-semibold transition-all",
          highlighted ? "bg-accent-green text-black" : "bg-zinc-600 text-text-main"
        )}
        style={{ width: `${widthPercent}%` }}
      >
        {count > 0 && count}
      </div>
    </div>
  );
}

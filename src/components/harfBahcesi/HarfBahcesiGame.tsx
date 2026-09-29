"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Delete, Shuffle } from "lucide-react";
import Hive from "@/components/harfBahcesi/Hive";
import { useHarfBahcesi } from "@/hooks/useHarfBahcesi";
import { RANKS, isPangram } from "@/lib/harfBahcesi";
import { cn, getTodayKey } from "@/lib/utils";

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function RankBar({ score, maxScore, rankIndex }: { score: number; maxScore: number; rankIndex: number }) {
  const nextRank = RANKS[rankIndex + 1];
  const currentThreshold = RANKS[rankIndex].threshold * maxScore;
  const nextThreshold = nextRank ? nextRank.threshold * maxScore : maxScore;
  const span = nextThreshold - currentThreshold;
  const progress = span > 0 ? Math.min(1, (score - currentThreshold) / span) : 1;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold text-text-main">{RANKS[rankIndex].label}</span>
        <span className="text-text-muted">{score} puan</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-card">
        <motion.div
          className="h-full rounded-full bg-accent-yellow"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

export default function HarfBahcesiGame({ arsivTarihi }: { arsivTarihi?: string }) {
  const {
    puzzle,
    foundWords,
    currentWord,
    error,
    shakeToken,
    lastPangram,
    score,
    maxScore,
    rank,
    addLetter,
    removeLetter,
    clearWord,
    submitWord,
  } = useHarfBahcesi(arsivTarihi);

  const [outerOrder, setOuterOrder] = useState<string[]>(
    () => puzzle.letters.filter((l) => l !== puzzle.centerLetter)
  );
  const [showList, setShowList] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bulunan kelimeler PAYLAŞILMIYOR — sadece sayıları, seviye ve pangram sayısı.
  // Aksi halde link'i alan kişi o günün cevaplarını görmüş olurdu.
  function handleShare() {
    const pangramCount = foundWords.filter((w) => isPangram(w, puzzle)).length;
    const text =
      `Günsel Harf Peteği ${getTodayKey()}\n` +
      `${rank.label} · ${score} puan · ${foundWords.length} kelime` +
      (pangramCount > 0 ? ` · ${pangramCount} pangram 🟡` : "") +
      `\nhttps://gunsel.app/harf-bahcesi`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 px-4 pb-2 sm:gap-5 sm:pb-4">
      <div className="w-full max-w-sm">
        <RankBar score={score} maxScore={maxScore} rankIndex={rank.index} />
      </div>

      <div className="flex min-h-[1.5rem] items-center text-sm font-medium text-accent-red">{error}</div>

      {lastPangram && (
        <p className="text-sm font-semibold text-accent-yellow">Pangram! +7 bonus — {lastPangram}</p>
      )}

      <motion.div
        animate={shakeToken > 0 ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="min-h-[2.5rem] text-2xl font-bold uppercase tracking-widest text-text-main"
      >
        {currentWord || <span className="text-text-muted">&nbsp;</span>}
      </motion.div>

      <Hive centerLetter={puzzle.centerLetter} outerLetters={outerOrder} onLetterClick={addLetter} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={removeLetter}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle text-text-main transition-colors hover:bg-card-hover"
          aria-label="Sil"
        >
          <Delete className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setOuterOrder(shuffleArray(outerOrder))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle text-text-main transition-colors hover:bg-card-hover"
          aria-label="Karıştır"
        >
          <Shuffle className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={submitWord}
          className="rounded-full bg-accent-green px-6 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-105"
        >
          Gönder
        </button>
        {currentWord && (
          <button
            type="button"
            onClick={clearWord}
            className="text-xs text-text-muted hover:text-text-main"
          >
            temizle
          </button>
        )}
      </div>

      <div className="flex w-full max-w-sm gap-2">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="flex-1 rounded-lg border border-border-subtle bg-card px-4 py-2 text-sm font-medium text-text-main transition-colors hover:bg-card-hover"
        >
          Bulunan Kelimeler ({foundWords.length})
        </button>
        {/* Diğer dört oyunun sonuç ekranında paylaşım vardı, burada yoktu — bu oyunun
            "bitiş" anı olmadığı için sonuç modalı da yok. Paylaşım o yüzden kelime
            listesinin yanına, istenildiği an basılabilecek bir butona konuldu. */}
        <button
          type="button"
          onClick={handleShare}
          disabled={foundWords.length === 0}
          className="shrink-0 rounded-lg bg-accent-green px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? "Kopyalandı!" : "Paylaş"}
        </button>
      </div>

      <div className="w-full max-w-sm">
        {showList && (
          <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-border-subtle bg-card p-3">
            {foundWords.length === 0 && (
              <p className="text-sm text-text-muted">Henüz kelime bulunamadı.</p>
            )}
            {[...foundWords].sort().map((word) => (
              <span
                key={word}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  isPangram(word, puzzle)
                    ? "bg-accent-yellow text-black"
                    : "bg-card-hover text-text-main"
                )}
              >
                {word}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

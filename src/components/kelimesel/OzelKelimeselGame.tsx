"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Keyboard from "@/components/Keyboard";
import Stepper from "@/components/Stepper";
import WordGrid from "@/components/kelimesel/WordGrid";
import OzelResultModal from "@/components/kelimesel/OzelResultModal";
import OzelWordResultModal from "@/components/kelimesel/OzelWordResultModal";
import { useKelimeselOzel } from "@/hooks/useKelimeselOzel";
import { cn } from "@/lib/utils";

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function OzelKelimeselGame({ shareCode }: { shareCode: string }) {
  const {
    loading,
    notFound,
    wordIndex,
    viewIndex,
    isViewingActive,
    wordLength,
    wordCount,
    maxGuesses,
    timeLimitSeconds,
    mode,
    startedAt,
    revealedWords,
    revealedWord,
    guesses,
    evaluations,
    initialGuessCount,
    currentGuess,
    status,
    error,
    shakeToken,
    keyboardStatuses,
    showResult,
    dismissResult,
    openResult,
    addLetter,
    removeLetter,
    submitGuess,
    pendingAdvance,
    continueToNextWord,
    viewWord,
  } = useKelimeselOzel(shareCode);

  // Sadece görsel geri sayım için — dolan süre gerçek anlamda sunucuda bir sonraki
  // tahmin gönderildiğinde uygulanıyor (bkz. guess route'taki time limit kontrolü).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timeLimitSeconds || status !== "PLAYING") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timeLimitSeconds, status]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-text-muted">Yükleniyor...</p>;
  }
  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <p className="text-sm text-text-muted">Bu bulmaca bulunamadı — link yanlış olabilir.</p>
        <Link href="/" className="text-sm font-medium text-accent-green underline-offset-2 hover:underline">
          Anasayfaya dön
        </Link>
      </div>
    );
  }

  const finished = status === "WON" || status === "LOST";
  const nowSeconds = Math.floor(now / 1000);
  const remainingSeconds =
    timeLimitSeconds != null && startedAt != null
      ? Math.max(0, timeLimitSeconds - (nowSeconds - startedAt))
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 px-4 pb-2 sm:gap-4 sm:pb-4">
      <div className="flex flex-col items-center gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-text-muted">
          Kelime {viewIndex + 1} / {wordCount}
          {!isViewingActive && (
            <span className="rounded-full bg-card-hover px-2 py-0.5 text-xs font-semibold text-text-muted">
              Geçmiş
            </span>
          )}
          {mode === "hard" && (
            <span className="rounded-full bg-accent-yellow/20 px-2 py-0.5 text-xs font-semibold text-accent-yellow">
              Zor Mod
            </span>
          )}
        </p>
        {remainingSeconds !== null && isViewingActive && (
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              remainingSeconds <= 10 ? "text-accent-red" : "text-text-main"
            )}
          >
            {formatCountdown(remainingSeconds)}
          </p>
        )}
      </div>

      <div className="flex min-h-[1.25rem] items-center text-sm font-medium text-accent-red">{error}</div>

      <WordGrid
        length={wordLength}
        maxAttempts={maxGuesses}
        guesses={guesses}
        evaluations={evaluations}
        initialGuessCount={initialGuessCount}
        currentGuess={currentGuess}
        shakeToken={shakeToken}
      />

      {!isViewingActive && revealedWord && (
        <p className="text-sm text-text-muted">
          Kelime: <span className="font-semibold text-text-main">{revealedWord}</span>
        </p>
      )}

      {finished && !showResult && (
        <button
          type="button"
          onClick={openResult}
          className="text-sm font-medium text-accent-green underline-offset-2 hover:underline"
        >
          Sonucu gör
        </button>
      )}

      {wordIndex > 0 && (
        <Stepper value={viewIndex + 1} min={1} max={wordIndex + 1} onChange={(v) => viewWord(v - 1)} label="Kelime" />
      )}

      <div className={cn(!isViewingActive && "pointer-events-none opacity-40")}>
        <Keyboard statuses={keyboardStatuses} onKey={addLetter} onEnter={submitGuess} onBackspace={removeLetter} />
      </div>

      {pendingAdvance && (
        <OzelWordResultModal
          won={pendingAdvance.won}
          word={pendingAdvance.word}
          wordIndex={wordIndex}
          wordCount={wordCount}
          onContinue={continueToNextWord}
        />
      )}

      {finished && showResult && (status === "WON" || status === "LOST") && (
        <OzelResultModal status={status} revealedWords={revealedWords} shareCode={shareCode} onClose={dismissResult} />
      )}
    </div>
  );
}

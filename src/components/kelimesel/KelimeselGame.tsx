"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/Stepper";
import Keyboard from "@/components/Keyboard";
import WordGrid from "@/components/kelimesel/WordGrid";
import ResultModal from "@/components/kelimesel/ResultModal";
import { useKelimesel } from "@/hooks/useKelimesel";
import { playSound } from "@/lib/sound";
import { MAX_LENGTH, MIN_LENGTH, type WordLength } from "@/lib/kelimesel";

function KelimeselBoard({
  length,
  onLengthChange,
  onNext,
  arsivTarihi,
}: {
  length: WordLength;
  onLengthChange: (length: WordLength) => void;
  onNext: () => void;
  arsivTarihi?: string;
}) {
  const {
    notFound,
    todayKey,
    revealedWord,
    maxAttempts,
    guesses,
    evaluations,
    initialGuessCount,
    initialAttempts,
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
  } = useKelimesel(length, arsivTarihi);

  if (notFound) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">Bu uzunluk için kelime bulunamadı.</p>
    );
  }

  const finished = status === "WON" || status === "LOST";
  const isLastLength = length === MAX_LENGTH;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 px-4 pb-2 sm:gap-4 sm:pb-4">
      {/* Harf sayısı seçici EN ÜSTTE: eskiden grid ile klavye arasındaydı ve tam
          başparmağın geçtiği yerdeydi — oyunun ortasında yanlışlıkla basınca başka bir
          kelime uzunluğuna atlayıp o anki tahtayı kaybettiriyordu. Ayrıca burası bir
          ayar, oyun alanı değil. */}
      <Stepper
        value={length}
        min={MIN_LENGTH}
        max={MAX_LENGTH}
        onChange={(next) => onLengthChange(next as WordLength)}
        label="Harf Sayısı"
      />

      <div className="flex min-h-[1.25rem] items-center text-sm font-medium text-accent-red">
        {error}
      </div>

      <WordGrid
        length={length}
        maxAttempts={maxAttempts}
        guesses={guesses}
        evaluations={evaluations}
        initialGuessCount={initialGuessCount}
        currentGuess={currentGuess}
        shakeToken={shakeToken}
      />

      {finished && !showResult && (
        <button
          type="button"
          onClick={openResult}
          className="text-sm font-medium text-accent-green underline-offset-2 hover:underline"
        >
          Sonucu gör
        </button>
      )}

      <Keyboard
        statuses={keyboardStatuses}
        onKey={addLetter}
        onEnter={submitGuess}
        onBackspace={removeLetter}
      />

      {finished && showResult && (status === "WON" || status === "LOST") && (
        <ResultModal
          status={status}
          length={length}
          date={todayKey}
          revealedWord={revealedWord}
          evaluations={evaluations}
          guessCount={evaluations.length > 0 ? evaluations.length : initialAttempts}
          maxAttempts={maxAttempts}
          onClose={dismissResult}
          onNext={onNext}
          isLastLength={isLastLength}
        />
      )}
    </div>
  );
}

export default function KelimeselGame({ arsivTarihi }: { arsivTarihi?: string }) {
  const [length, setLength] = useState<WordLength>(MIN_LENGTH);
  const router = useRouter();

  function handleNext() {
    if (length < MAX_LENGTH) {
      playSound("modeSwitch");
      setLength((length + 1) as WordLength);
    } else {
      router.push("/");
    }
  }

  return (
    <KelimeselBoard
      key={length}
      length={length}
      onLengthChange={(next) => {
        playSound("modeSwitch");
        setLength(next);
      }}
      onNext={handleNext}
      arsivTarihi={arsivTarihi}
    />
  );
}

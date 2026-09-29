"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AudioPlayer, { type AudioPlayerHandle } from "@/components/sarkisal/AudioPlayer";
import ProgressBar from "@/components/sarkisal/ProgressBar";
import SongSearch from "@/components/sarkisal/SongSearch";
import GuessList from "@/components/sarkisal/GuessList";
import ResultModal from "@/components/sarkisal/ResultModal";
import { useSarkisal } from "@/hooks/useSarkisal";
import { SONG_CATEGORIES } from "@/lib/sarkisal";
import { cn } from "@/lib/utils";

function CategoryTabs({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex justify-center gap-1 rounded-lg border border-border-subtle bg-card p-1">
      {SONG_CATEGORIES.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onChange(category.id)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === category.id
              ? "bg-card-hover text-text-main"
              : "text-text-muted hover:text-text-main"
          )}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}

function SarkisalBoard({ categoryId, onNext, arsivTarihi }: { categoryId: string; onNext: () => void; arsivTarihi?: string }) {
  const {
    audioUrl,
    loading,
    notFound,
    status,
    guessRows,
    revealedAnswer,
    stageIndex,
    maxSeconds,
    maxAttempts,
    submitGuess,
    skip,
    isSubmitting,
    showResult,
    dismissResult,
    openResult,
  } = useSarkisal(categoryId, arsivTarihi);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);

  if (notFound) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">Bu kategori için şarkı bulunamadı.</p>
    );
  }

  const wonStageIndex = status === "WON" ? guessRows.length - 1 : null;
  const finished = status === "WON" || status === "LOST";
  const isLastCategory = SONG_CATEGORIES[SONG_CATEGORIES.length - 1].id === categoryId;

  // Pas geçerken ses çalıyorsa kesilmesin, aynı aşamanın uzayan süresine göre
  // (AudioPlayer'daki maxSeconds efekti) kesintisiz devam etsin — bu yüzden burada
  // durdurmuyoruz. Bir tahmin GÖNDERİLİNCE ise (doğru/yanlış), sunucu cevabını
  // beklemeden anında durdurup pozisyonu sıfırlıyoruz — yeni aşama baştan dinlenir.
  function handleSelect(song: Parameters<typeof submitGuess>[0]) {
    audioPlayerRef.current?.stop();
    submitGuess(song);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 pb-2 sm:gap-6 sm:pb-4">
      <GuessList rows={guessRows} maxAttempts={maxAttempts} won={status === "WON"} />

      <ProgressBar stageIndex={stageIndex} wonStageIndex={wonStageIndex} playbackSeconds={playbackSeconds} />

      <AudioPlayer
        ref={audioPlayerRef}
        src={audioUrl}
        maxSeconds={maxSeconds}
        disabled={loading || status !== "PLAYING"}
        onProgress={setPlaybackSeconds}
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

      {status === "PLAYING" && (
        <SongSearch
          onSelect={handleSelect}
          onSkip={skip}
          disabled={isSubmitting}
          isLastAttempt={guessRows.length === maxAttempts - 1}
        />
      )}

      {finished && showResult && revealedAnswer && (status === "WON" || status === "LOST") && (
        <ResultModal
          status={status}
          answer={revealedAnswer}
          audioUrl={audioUrl}
          guessRows={guessRows}
          maxAttempts={maxAttempts}
          onClose={dismissResult}
          onNext={onNext}
          isLastCategory={isLastCategory}
        />
      )}
    </div>
  );
}

export default function SarkisalGame({ arsivTarihi }: { arsivTarihi?: string }) {
  const [categoryId, setCategoryId] = useState(SONG_CATEGORIES[0].id);
  const router = useRouter();

  function handleNext() {
    const currentIndex = SONG_CATEGORIES.findIndex((c) => c.id === categoryId);
    const next = SONG_CATEGORIES[currentIndex + 1];
    if (next) setCategoryId(next.id);
    else router.push("/");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 sm:gap-6">
      <CategoryTabs value={categoryId} onChange={setCategoryId} />
      <SarkisalBoard key={categoryId} categoryId={categoryId} onNext={handleNext} arsivTarihi={arsivTarihi} />
    </div>
  );
}

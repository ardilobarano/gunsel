"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FrameViewer from "@/components/karesel/FrameViewer";
import MovieSearch from "@/components/karesel/MovieSearch";
import GuessList from "@/components/karesel/GuessList";
import ResultModal from "@/components/karesel/ResultModal";
import { useKaresel } from "@/hooks/useKaresel";
import { KARESEL_KATEGORILERI } from "@/lib/karesel";
import { cn } from "@/lib/utils";

/* Şarkısal ve Haritasal'ın sekmeleriyle birebir aynı görünüm — üç oyunda üç
   farklı sekme biçimi olmasın diye sınıflar bilerek kopyalandı. */
function KategoriSekmeleri({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex w-full justify-center gap-1 rounded-lg border border-border-subtle bg-card p-1">
      {KARESEL_KATEGORILERI.map((kategori) => (
        <button
          key={kategori.id}
          type="button"
          onClick={() => onChange(kategori.id)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === kategori.id
              ? "bg-card-hover text-text-main"
              : "text-text-muted hover:text-text-main"
          )}
        >
          {kategori.label}
        </button>
      ))}
    </div>
  );
}

function KareselTahta({ kategoriId, arsivTarihi }: { kategoriId: string; arsivTarihi?: string }) {
  const {
    loading,
    notFound,
    status,
    frames,
    currentFrameIndex,
    guessRows,
    revealedMovie,
    maxAttempts,
    submitGuess,
    skip,
    isSubmitting,
    showResult,
    dismissResult,
    openResult,
  } = useKaresel(kategoriId, arsivTarihi);
  const router = useRouter();

  if (notFound) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">
        Bugün için {kategoriId === "dizi" ? "dizi" : "film"} bulunamadı.
      </p>
    );
  }

  const finished = status === "WON" || status === "LOST";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 sm:gap-6">
      <FrameViewer
        frames={frames}
        currentIndex={currentFrameIndex}
        maxAttempts={maxAttempts}
        loading={loading && frames.length === 0}
      />

      <GuessList rows={guessRows} maxAttempts={maxAttempts} won={status === "WON"} />

      {status === "PLAYING" && (
        <MovieSearch
          onSelect={submitGuess}
          onSkip={skip}
          disabled={isSubmitting || loading}
          isLastAttempt={guessRows.length === maxAttempts - 1}
          kategoriId={kategoriId}
        />
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

      {finished && showResult && revealedMovie && (status === "WON" || status === "LOST") && (
        <ResultModal
          status={status}
          answer={revealedMovie}
          frames={frames}
          guessRows={guessRows}
          maxAttempts={maxAttempts}
          onClose={dismissResult}
          onHome={() => router.push("/")}
        />
      )}
    </div>
  );
}

export default function KareselGame({ arsivTarihi }: { arsivTarihi?: string }) {
  const [kategoriId, setKategoriId] = useState<string>(KARESEL_KATEGORILERI[0].id);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 px-4 pb-2 sm:gap-6 sm:pb-4">
      <KategoriSekmeleri value={kategoriId} onChange={setKategoriId} />
      {/* key: sekme değişince tahta SIFIRDAN kuruluyor. Olmasaydı hook eski
          sekmenin kareleri ve tahminleriyle açılır, yeni sekmenin kaydı gelene
          kadar bir kare boyunca yanlış içerik görünürdü. */}
      <KareselTahta key={kategoriId} kategoriId={kategoriId} arsivTarihi={arsivTarihi} />
    </div>
  );
}

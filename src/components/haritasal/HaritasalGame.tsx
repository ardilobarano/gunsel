"use client";

import { useState } from "react";
import { useHaritasal } from "@/hooks/useHaritasal";
import { HARITASAL_KATEGORILERI } from "@/lib/haritasal";
import { cn } from "@/lib/utils";
import UlkeSecici from "./UlkeSecici";
import TahminListesi from "./TahminListesi";
import SonucModal from "./SonucModal";

/* Şarkısal'ın kategori sekmeleriyle aynı görünüm — iki oyunda iki farklı sekme
   biçimi olmasın diye bilerek birebir aynı sınıflar kullanıldı. */
function KategoriSekmeleri({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex justify-center gap-1 rounded-lg border border-border-subtle bg-card p-1">
      {HARITASAL_KATEGORILERI.map((kategori) => (
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

function HaritasalTahta({ kategoriId, arsivTarihi }: { kategoriId: string; arsivTarihi?: string }) {
  const {
    loading,
    notFound,
    status,
    path,
    options,
    guesses,
    revealed,
    maxAttempts,
    submitting,
    showResult,
    submitGuess,
    dismissResult,
    openResult,
  } = useHaritasal(kategoriId, arsivTarihi);

  const kategoriEtiketi =
    HARITASAL_KATEGORILERI.find((k) => k.id === kategoriId)?.label ?? "";

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-text-muted">Yükleniyor…</p>;
  }
  if (notFound || !path) {
    return <p className="px-4 py-16 text-center text-sm text-text-muted">Bugün için bulmaca yok.</p>;
  }

  const bitti = status !== "PLAYING";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Siluet. viewBox 0-100: veri zaten o kutuya normalize edilmiş
          (bkz. scripts/fetch-haritasal.ts). */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <svg viewBox="0 0 100 100" className="h-full max-h-[38vh] w-auto max-w-full">
          <path d={path} className="fill-text-main" />
        </svg>
      </div>

      <TahminListesi guesses={guesses} maxAttempts={maxAttempts} kategoriId={kategoriId} />

      {bitti ? (
        <button
          type="button"
          onClick={openResult}
          className="w-full rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black"
        >
          Sonucu göster
        </button>
      ) : (
        <UlkeSecici
          options={options}
          onSelect={submitGuess}
          disabled={submitting}
          ipucu={kategoriId === "iller" ? "Bir il ara" : "Bir ülke ara"}
        />
      )}

      {showResult && revealed && (
        <SonucModal
          won={status === "WON"}
          answer={revealed}
          guesses={guesses}
          maxAttempts={maxAttempts}
          kategoriEtiketi={kategoriEtiketi}
          onClose={dismissResult}
        />
      )}
    </div>
  );
}

export default function HaritasalGame({ arsivTarihi }: { arsivTarihi?: string }) {
  const [kategoriId, setKategoriId] = useState<string>(HARITASAL_KATEGORILERI[0].id);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3">
      <KategoriSekmeleri value={kategoriId} onChange={setKategoriId} />
      {/* key: sekme değişince tahta SIFIRDAN kuruluyor. Olmasaydı hook eski
          sekmenin tahminleriyle açılır, yeni sekmenin kaydı gelene kadar bir kare
          boyunca yanlış liste görünürdü (Şarkısal'da da aynı desen). */}
      <HaritasalTahta key={kategoriId} kategoriId={kategoriId} arsivTarihi={arsivTarihi} />
    </div>
  );
}

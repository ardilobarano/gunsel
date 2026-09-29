"use client";

import { useState } from "react";
import { useRenksel } from "@/hooks/useRenksel";
import { hsbToHex, TUR_PUANI } from "@/lib/renksel";
import RenkSecici from "./RenkSecici";
import SonucModal from "./SonucModal";

/** Başlangıç rengi bilerek NÖTR bir gri: canlı bir renkle başlamak oyuncuyu
 *  o tona doğru çekiyordu (ilk turda herkes kırmızıya yakın tahmin veriyordu). */
const BASLANGIC: [number, number, number] = [0, 0, 60];

export default function RenkselGame({ arsivTarihi }: { arsivTarihi?: string }) {
  const {
    loading,
    notFound,
    status,
    turlar,
    sonuclar,
    turIndeksi,
    ortalama,
    submitting,
    showResult,
    tahminGonder,
    dismissResult,
    openResult,
  } = useRenksel(arsivTarihi);

  const [[ton, doygunluk, parlaklik], setHsb] = useState(BASLANGIC);
  const tahmin = hsbToHex(ton, doygunluk, parlaklik);

  if (loading) return <p className="px-4 py-16 text-center text-sm text-text-muted">Yükleniyor…</p>;
  if (notFound || turlar.length === 0) {
    return <p className="px-4 py-16 text-center text-sm text-text-muted">Bugün için bulmaca yok.</p>;
  }

  const bitti = status !== "PLAYING";
  const tur = turlar[Math.min(turIndeksi, turlar.length - 1)];
  const sonSonuc = sonuclar[sonuclar.length - 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 px-4 pb-3">
      <p className="text-center text-base font-semibold text-text-main">
        {tur.baslik} <span className="font-normal text-text-muted">hangi renk?</span>
        <span className="block text-xs font-normal text-text-muted">{tur.kaynak}</span>
      </p>

      {/* Bölge oyuncunun seçtiği renkle ANINDA doluyor. Oyunun asıl geri
          bildirimi bu — ayrı bir renk örneği kutusu aynı şeyi anlatmıyor,
          çünkü aynı renk fotoğrafın üstünde bambaşka görünüyor.

          NASIL: fotoğrafın o bölgesi zaten GÖLGE HARİTASINA (griye) çevrilmiş
          hâlde geliyor; üstüne seçilen renk `multiply` ile biniyor. Düz renk
          basmak sahte duruyordu — çarpma, kumaşın dokusunu ve kıvrım gölgesini
          olduğu gibi bırakıp yalnızca rengi değiştiriyor.

          `isolation: isolate` ŞART: olmadan `multiply` sayfanın zeminiyle de
          karışır ve fotoğrafın dışına taşar. */}
      <div
        className="relative w-full max-w-[320px] overflow-hidden rounded-lg"
        style={{ isolation: "isolate", aspectRatio: `${tur.genislik} / ${tur.yukseklik}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- katmanlama
            ve mix-blend-mode için ham <img> gerekiyor; bu görseller zaten
            kendi sunucumuzda ve son boyutunda üretiliyor. */}
        <img src={tur.foto} alt={tur.baslik} className="block h-full w-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundColor: bitti && sonSonuc ? sonSonuc.dogru : tahmin,
            mixBlendMode: "multiply",
            maskImage: `url(${tur.maske})`,
            WebkitMaskImage: `url(${tur.maske})`,
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
          }}
        />
      </div>

      {bitti ? (
        <div className="flex w-full flex-col items-center gap-3">
          <p className="text-lg font-bold text-text-main">
            {ortalama.toFixed(1)} / {TUR_PUANI}
          </p>
          <button
            type="button"
            onClick={openResult}
            className="w-full rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black"
          >
            Sonucu göster
          </button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <RenkSecici
            ton={ton}
            doygunluk={doygunluk}
            parlaklik={parlaklik}
            onChange={(t, d, p) => setHsb([t, d, p])}
            disabled={submitting}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              tahminGonder(tahmin);
              setHsb(BASLANGIC);
            }}
            className="w-full rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            Rengi onayla
          </button>
        </div>
      )}

      {showResult && (
        <SonucModal sonuclar={sonuclar} puan={ortalama} onClose={dismissResult} />
      )}
    </div>
  );
}

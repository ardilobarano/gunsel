import Header from "@/components/Header";
import OyunAciklamasi from "@/components/OyunAciklamasi";
import type { Metadata } from "next";
import ArsivBanner from "@/components/ArsivBanner";
import { getServerTodayKey, resolveArsivTarihi } from "@/lib/arsiv.server";
import HelpButton from "@/components/sarkisal/HelpButton";
import JsonLd from "@/components/JsonLd";
import SarkisalGameLoader from "@/components/sarkisal/SarkisalGameLoader";
import { oyunSemasi } from "@/lib/seo";

/* Tek kaynak: aynı metin hem <meta description>'a hem yapısal veriye gidiyor. */
const ACIKLAMA =
  "Şarkıyı ilk saniyesinden tanı. Heardle tarzı günlük Türkçe şarkı tahmin oyunu; Tümü, Pop ve Rap kategorilerinin her günü ayrı.";

export const metadata: Metadata = {
  title: "Şarkısal — Şarkı Tahmin Oyunu | Günsel",
  description: ACIKLAMA,
  alternates: { canonical: "/sarkisal" },
  openGraph: {
    title: "Şarkısal — Günsel",
    description: "Şarkıyı ilk saniyeden tanı. Tümü, Pop ve Rap kategorileri.",
  },
};

export default async function SarkisalPage({
  searchParams,
}: {
  searchParams: Promise<{ tarih?: string }>;
}) {
  const arsivTarihi = await resolveArsivTarihi(
    searchParams,
    getServerTodayKey(),
  );

  return (
    /* Fragman: tanıtım metni h-dvh kabın DIŞINDA duruyor. İçine konulduğunda
       flex-1 olan oyun alanı metinle yer paylaşıyor ve 664px'lik ekranda oyuna
       yalnızca 290px kalıyordu (ölçüldü).
       h-dvh: sayfa ekran yüksekliğine sabitleniyor, içerik taşmıyor. Eskiden
       iPhone 13'te 125px, SE'de 221px taşıyordu — arama kutusu ve "Pas Geç"
       ekranın altında kalıyordu. */
    <>
      <JsonLd
        data={oyunSemasi({
          ad: "Şarkısal",
          yol: "/sarkisal",
          aciklama: ACIKLAMA,
        })}
      />
      <div className="flex h-dvh flex-col overflow-y-auto bg-background">
        <Header />
        {arsivTarihi && <ArsivBanner tarih={arsivTarihi} />}
        <main className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col">
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-2 sm:pt-6 sm:pb-4">
            <h1 className="text-xl font-bold text-text-main">Şarkısal</h1>
            <HelpButton />
          </div>
          <SarkisalGameLoader arsivTarihi={arsivTarihi ?? undefined} />
        </main>
      </div>

      <OyunAciklamasi
        baslik="Şarkısal nasıl oynanır?"
        paragraflar={[
          "Şarkısal, günün şarkısını kısa bir kesitten tahmin etme oyunudur. İlk hakkında yalnızca 0,2 saniye dinlersin; her yanlış tahminde veya pas geçişte süre uzar.",
          "Tümü, Pop ve Rap olmak üzere üç kategori var ve her birinin günlük şarkısı ayrıdır. Tahminin yanlış ama sanatçı doğruysa satır sarıya döner.",
        ]}
      />
    </>
  );
}

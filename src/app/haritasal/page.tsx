import type { Metadata } from "next";
import Header from "@/components/Header";
import OyunAciklamasi from "@/components/OyunAciklamasi";
import ArsivBanner from "@/components/ArsivBanner";
import HaritasalGameLoader from "@/components/haritasal/HaritasalGameLoader";
import HelpButton from "@/components/haritasal/HelpButton";
import JsonLd from "@/components/JsonLd";
import { getServerTodayKey, resolveArsivTarihi } from "@/lib/arsiv.server";
import { oyunSemasi } from "@/lib/seo";

/* Tek kaynak: aynı metin hem <meta description>'a hem yapısal veriye gidiyor. */
const ACIKLAMA =
  "Ülkeyi ya da Türkiye ilini yalnızca siluetinden tahmin et. Worldle tarzı günlük coğrafya oyunu; her tahminde yön oku ve sıcak-soğuk ipucu alırsın.";

export const metadata: Metadata = {
  title: "Haritasal — Ülke ve İl Tahmin Oyunu | Günsel",
  description: ACIKLAMA,
  /* canonical şart: bu sayfa ?tarih= ile arşivden de açılıyor, canonical olmadan
     her arşiv günü ayrı bir kopya sayfa gibi görünürdü. */
  alternates: { canonical: "/haritasal" },
  openGraph: {
    title: "Haritasal — Günsel",
    description: "Ülkeyi ya da ili siluetinden bul. Altı hak, yön ve sıcaklık ipucu.",
  },
};

export default async function HaritasalPage({
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
       yalnızca 290px kalıyordu (ölçüldü). */
    <>
      <JsonLd
        data={oyunSemasi({
          ad: "Haritasal",
          yol: "/haritasal",
          aciklama: ACIKLAMA,
        })}
      />
      <div className="flex h-dvh flex-col overflow-y-auto bg-background">
        <Header />
        {arsivTarihi && <ArsivBanner tarih={arsivTarihi} />}
        <main className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col">
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-2 sm:pt-6 sm:pb-4">
            <h1 className="text-xl font-bold text-text-main">Haritasal</h1>
            <HelpButton />
          </div>
          <HaritasalGameLoader arsivTarihi={arsivTarihi ?? undefined} />
        </main>
      </div>

      <OyunAciklamasi
        baslik="Haritasal nasıl oynanır?"
        paragraflar={[
          "Haritasal, bir bölgeyi yalnızca siluetinden bulma oyunudur. Altı tahmin hakkın var ve her tahminden sonra iki ipucu alırsın: doğru cevabın hangi yönde kaldığı ve ne kadar yakın olduğunu gösteren sıcaklık.",
          "İki sekme var: Dünya Ülkeleri ve Türkiye İlleri. Her sekmenin günlük silueti ayrıdır ve sıcaklık eşikleri de ayrıdır; Türkiye ölçeğinde en yakın kademe 150 kilometre, dünya ölçeğinde bin kilometredir.",
        ]}
      />
    </>
  );
}

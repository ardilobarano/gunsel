import Header from "@/components/Header";
import OyunAciklamasi from "@/components/OyunAciklamasi";
import type { Metadata } from "next";
import ArsivBanner from "@/components/ArsivBanner";
import { getServerTodayKey, resolveArsivTarihi } from "@/lib/arsiv.server";
import DahaAzCokGameLoader from "@/components/dahaAzCok/DahaAzCokGameLoader";
import HelpButton from "@/components/dahaAzCok/HelpButton";
import JsonLd from "@/components/JsonLd";
import { oyunSemasi } from "@/lib/seo";

/* Tek kaynak: aynı metin hem <meta description>'a hem yapısal veriye gidiyor. */
const ACIKLAMA =
  "İki değerden hangisi daha büyük? Higher Lower tarzı günlük tahmin oyunu; nüfus, IMDB puanı, YouTube izlenmesi ve genel kültür kategorileriyle.";

export const metadata: Metadata = {
  title: "Daha Az / Daha Çok — Hangisi Daha Fazla Oyunu | Günsel",
  description: ACIKLAMA,
  alternates: { canonical: "/daha-az-cok" },
  openGraph: {
    title: "Daha Az / Daha Çok — Günsel",
    description: "Hangisi daha fazla? Altı kategoride günlük tahmin oyunu.",
  },
};

export default async function DahaAzCokPage({
  searchParams,
}: {
  searchParams: Promise<{ tarih?: string }>;
}) {
  const arsivTarihi = await resolveArsivTarihi(
    searchParams,
    getServerTodayKey(),
  );

  return (
    /* Tanıtım metni oyun kabının DIŞINDA — diğer oyun sayfalarıyla aynı yapı. */
    <>
      <JsonLd
        data={oyunSemasi({
          ad: "Daha Az / Daha Çok",
          yol: "/daha-az-cok",
          aciklama: ACIKLAMA,
        })}
      />
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        {arsivTarihi && <ArsivBanner tarih={arsivTarihi} />}
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <div className="flex items-center justify-center gap-1.5 pt-6 pb-4">
            <h1 className="text-xl font-bold text-text-main">
              Daha Az / Daha Çok
            </h1>
            <HelpButton />
          </div>
          <DahaAzCokGameLoader arsivTarihi={arsivTarihi ?? undefined} />
        </main>
      </div>

      <OyunAciklamasi
        baslik="Daha Az / Daha Çok nasıl oynanır?"
        paragraflar={[
          "İki şey karşılaştırılır ve sağdaki değerin soldakinden büyük mü küçük mü olduğunu tahmin edersin. Yanlış tahmin oyunu bitirmez; zincir beş tur sürer ve sonunda skorunu görürsün.",
          "Altı kategori var: ülke ve şehir nüfusları, film ve dizi IMDB puanları, YouTube izlenme sayıları, büyük teknoloji satın almaları ve genel kültür değerleri.",
        ]}
      />
    </>
  );
}

import Header from "@/components/Header";
import OyunAciklamasi from "@/components/OyunAciklamasi";
import type { Metadata } from "next";
import ArsivBanner from "@/components/ArsivBanner";
import { getServerTodayKey, resolveArsivTarihi } from "@/lib/arsiv.server";
import HarfBahcesiGameLoader from "@/components/harfBahcesi/HarfBahcesiGameLoader";
import HelpButton from "@/components/harfBahcesi/HelpButton";
import JsonLd from "@/components/JsonLd";
import { oyunSemasi } from "@/lib/seo";

/* Tek kaynak: aynı metin hem <meta description>'a hem yapısal veriye gidiyor. */
const ACIKLAMA =
  "Yedi harften olabildiğince çok Türkçe kelime türet. Spelling Bee tarzı günlük kelime oyunu; ortadaki harf zorunlu, yedi harfi birden kullanan pangram bonus getirir.";

export const metadata: Metadata = {
  title: "Harf Peteği — Harflerden Kelime Türetme Oyunu | Günsel",
  description: ACIKLAMA,
  alternates: { canonical: "/harf-bahcesi" },
  openGraph: {
    title: "Harf Peteği — Günsel",
    description: "Yedi harften kelime türet. Her gün yeni bir petek.",
  },
};

export default async function HarfBahcesiPage({
  searchParams,
}: {
  searchParams: Promise<{ tarih?: string }>;
}) {
  const arsivTarihi = await resolveArsivTarihi(
    searchParams,
    getServerTodayKey(),
  );

  return (
    /* Diğer oyun sayfalarıyla aynı: ekran yüksekliğine sabit, içerik taşmıyor.
       Tanıtım metni kabın DIŞINDA — içine konulduğunda oyun alanı onunla yer
       paylaşıyor ve oyuna çok az yer kalıyordu (ölçüldü). */
    <>
      {/* ad: görünen isim "Harf Peteği" — adresteki /harf-bahcesi eski isimden
          kalma ve bilerek değiştirilmedi (gameId localStorage anahtarı). */}
      <JsonLd
        data={oyunSemasi({
          ad: "Harf Peteği",
          yol: "/harf-bahcesi",
          aciklama: ACIKLAMA,
        })}
      />
      <div className="flex h-dvh flex-col overflow-y-auto bg-background">
        <Header />
        {arsivTarihi && <ArsivBanner tarih={arsivTarihi} />}
        <main className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col">
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-2 sm:pt-6 sm:pb-4">
            <h1 className="text-xl font-bold text-text-main">Harf Peteği</h1>
            <HelpButton />
          </div>
          <HarfBahcesiGameLoader arsivTarihi={arsivTarihi ?? undefined} />
        </main>
      </div>

      <OyunAciklamasi
        baslik="Harf Peteği nasıl oynanır?"
        paragraflar={[
          "Harf Peteği, yedi harften olabildiğince çok Türkçe kelime türetme oyunudur. Ortadaki harf zorunludur ve her kelime en az dört harfli olmalıdır; harfleri istediğin kadar tekrar kullanabilirsin.",
          "Dört harfli kelime 1 puan, daha uzunları harf sayısı kadar puan getirir. Yedi harfin hepsini kullanan kelime pangramdır ve 7 puan bonus kazandırır.",
        ]}
      />
    </>
  );
}

import type { Metadata } from "next";
import Header from "@/components/Header";
import OyunAciklamasi from "@/components/OyunAciklamasi";
import ArsivBanner from "@/components/ArsivBanner";
import BaglamsalGameLoader from "@/components/baglamsal/BaglamsalGameLoader";
import HelpButton from "@/components/baglamsal/HelpButton";
import JsonLd from "@/components/JsonLd";
import { getServerTodayKey, resolveArsivTarihi } from "@/lib/arsiv.server";
import { oyunSemasi } from "@/lib/seo";

/* Tek kaynak: aynı metin hem <meta description>'a hem yapısal veriye gidiyor. */
const ACIKLAMA =
  "On altı kelimeyi ortak bağlarına göre dörder kelimelik dört gizli gruba ayır. Connections tarzı günlük Türkçe kelime oyunu; dört hata hakkın var.";

export const metadata: Metadata = {
  title: "Bağlamsal — Kelime Gruplama Oyunu | Günsel",
  description: ACIKLAMA,
  /* canonical şart: bu sayfa ?tarih= ile arşivden de açılıyor, canonical olmadan
     her arşiv günü ayrı bir kopya sayfa gibi görünürdü. */
  alternates: { canonical: "/baglamsal" },
  openGraph: {
    title: "Bağlamsal — Günsel",
    description: "On altı kelime, dört gizli grup, dört hata hakkı.",
  },
};

export default async function BaglamsalPage({
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
          ad: "Bağlamsal",
          yol: "/baglamsal",
          aciklama: ACIKLAMA,
        })}
      />
      <div className="flex h-dvh flex-col overflow-y-auto bg-background">
        <Header />
        {arsivTarihi && <ArsivBanner tarih={arsivTarihi} />}
        <main className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col">
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-2 sm:pt-6 sm:pb-4">
            <h1 className="text-xl font-bold text-text-main">Bağlamsal</h1>
            <HelpButton />
          </div>
          <BaglamsalGameLoader arsivTarihi={arsivTarihi ?? undefined} />
        </main>
      </div>

      <OyunAciklamasi
        baslik="Bağlamsal nasıl oynanır?"
        paragraflar={[
          "Bağlamsal'da on altı kelime vardır ve bunları ortak bağı olan dörder kelimelik dört gruba ayırman gerekir. Dört hata hakkın var; üç kelimeyi doğru seçtiysen “bir tane eksik” uyarısı gelir.",
          "Oyunun asıl zorluğu tuzak kelimelerdedir. Bir kategori beş üyeliymiş gibi duruyorsa, o beşliden biri mutlaka başka bir gruba aittir.",
        ]}
      />
    </>
  );
}

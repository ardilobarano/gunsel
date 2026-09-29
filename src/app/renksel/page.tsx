import type { Metadata } from "next";
import Header from "@/components/Header";
import OyunAciklamasi from "@/components/OyunAciklamasi";
import ArsivBanner from "@/components/ArsivBanner";
import RenkselGameLoader from "@/components/renksel/RenkselGameLoader";
import HelpButton from "@/components/renksel/HelpButton";
import JsonLd from "@/components/JsonLd";
import { getServerTodayKey, resolveArsivTarihi } from "@/lib/arsiv.server";
import { oyunSemasi } from "@/lib/seo";

/* Tek kaynak: aynı metin hem <meta description>'a hem yapısal veriye gidiyor. */
const ACIKLAMA =
  "Görseldeki eksik bölgenin rengini hatırla. Günlük renk hafızası oyunu; tek hak, on üzerinden puan.";

export const metadata: Metadata = {
  title: "Renksel — Renk Hafızası Oyunu | Günsel",
  description: ACIKLAMA,
  /* canonical şart: bu sayfa ?tarih= ile arşivden de açılıyor. */
  alternates: { canonical: "/renksel" },
  openGraph: {
    title: "Renksel — Günsel",
    description: "Eksik bölgenin rengini hatırla. Tek hak, on üzerinden puan.",
  },
};

export default async function RenkselPage({
  searchParams,
}: {
  searchParams: Promise<{ tarih?: string }>;
}) {
  const arsivTarihi = await resolveArsivTarihi(searchParams, getServerTodayKey());

  return (
    /* Fragman: tanıtım metni h-dvh kabın DIŞINDA — içine konulduğunda oyun
       alanına küçük ekranlarda çok az yer kalıyor (bkz. diğer oyun sayfaları). */
    <>
      <JsonLd data={oyunSemasi({ ad: "Renksel", yol: "/renksel", aciklama: ACIKLAMA })} />
      <div className="flex h-dvh flex-col overflow-y-auto bg-background">
        <Header />
        {arsivTarihi && <ArsivBanner tarih={arsivTarihi} />}
        <main className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col">
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-2 sm:pt-6 sm:pb-4">
            <h1 className="text-xl font-bold text-text-main">Renksel</h1>
            <HelpButton />
          </div>
          <RenkselGameLoader arsivTarihi={arsivTarihi ?? undefined} />
        </main>
      </div>

      <OyunAciklamasi
        baslik="Renksel nasıl oynanır?"
        paragraflar={[
          "Renksel, bir görselde rengi silinmiş bölgenin gerçek rengini hatırlama oyunudur. Ton, doygunluk ve parlaklık kaydırıcılarıyla aklındaki rengi kurarsın; seçtiğin renk görselin üstünde anında görünür.",
          "Her gün tek soru var ve tek hakkın bulunur; onayladıktan sonra rengi değiştiremezsin. Puan, seçtiğin rengin doğrusuna gözle ne kadar yakın olduğuna göre on üzerinden verilir.",
        ]}
      />
    </>
  );
}

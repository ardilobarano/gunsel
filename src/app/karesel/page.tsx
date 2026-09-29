import Header from "@/components/Header";
import OyunAciklamasi from "@/components/OyunAciklamasi";
import type { Metadata } from "next";
import ArsivBanner from "@/components/ArsivBanner";
import { getServerTodayKey, resolveArsivTarihi } from "@/lib/arsiv.server";
import KareselGameLoader from "@/components/karesel/KareselGameLoader";
import HelpButton from "@/components/karesel/HelpButton";
import JsonLd from "@/components/JsonLd";
import { oyunSemasi } from "@/lib/seo";

/* Tek kaynak: aynı metin hem <meta description>'a hem yapısal veriye gidiyor. */
const ACIKLAMA =
  "Tek bir kareden filmi ya da diziyi bil. Framed tarzı günlük tahmin oyunu; altı kare, altı hak, havuzda Türk yapımları da var.";

export const metadata: Metadata = {
  title: "Karesel — Film ve Dizi Tahmin Oyunu | Günsel",
  description: ACIKLAMA,
  alternates: { canonical: "/karesel" },
  openGraph: {
    title: "Karesel — Günsel",
    description: "Tek kareden filmi ya da diziyi bil. Altı kare, altı hak.",
  },
};

export default async function KareselPage({
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
      <JsonLd
        data={oyunSemasi({
          ad: "Karesel",
          yol: "/karesel",
          aciklama: ACIKLAMA,
        })}
      />
      <div className="flex h-dvh flex-col overflow-y-auto bg-background">
        <Header />
        {arsivTarihi && <ArsivBanner tarih={arsivTarihi} />}
        <main className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col">
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-2 sm:pt-6 sm:pb-4">
            <h1 className="text-xl font-bold text-text-main">Karesel</h1>
            <HelpButton />
          </div>
          <KareselGameLoader arsivTarihi={arsivTarihi ?? undefined} />
        </main>
      </div>

      <OyunAciklamasi
        baslik="Karesel nasıl oynanır?"
        paragraflar={[
          "Karesel, tek bir kareden yapımı tahmin etme oyunudur. İlk kare en bilinmedik olanıdır; her yanlış tahminde veya pas geçişte daha tanıdık bir kare açılır. Altı kare, altı hak. İki sekme var: Film ve Dizi; her birinin günlük yapımı ayrıdır.",
          "Havuzda yüzlerce film var ve içinde Türk yapımları da bulunuyor. Aynı gün herkes aynı filmi oynar.",
        ]}
      />
    </>
  );
}

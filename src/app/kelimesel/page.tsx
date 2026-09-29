import Link from "next/link";
import type { Metadata } from "next";
import ArsivBanner from "@/components/ArsivBanner";
import { getServerTodayKey, resolveArsivTarihi } from "@/lib/arsiv.server";
import Header from "@/components/Header";
import OyunAciklamasi from "@/components/OyunAciklamasi";
import HelpButton from "@/components/kelimesel/HelpButton";
import JsonLd from "@/components/JsonLd";
import KelimeselGameLoader from "@/components/kelimesel/KelimeselGameLoader";
import { oyunSemasi } from "@/lib/seo";

/* title arama motoru için (kimse "kelimesel" aramıyor, "türkçe kelime oyunu"
   arıyor), openGraph.title paylaşım kartı için KISA tutuluyor — WhatsApp'ta uzun
   başlık kırpılıyor. Wordle/Heardle gibi marka adları bilerek yalnızca
   description'da; başlıkta kullanmak marka açısından gereksiz risk. */
/* Tek kaynak: aynı metin hem <meta description>'a hem yapısal veriye gidiyor. */
const ACIKLAMA =
  "Günün gizli Türkçe kelimesini altı denemede bul. Wordle tarzı günlük kelime oyunu; 3 harften 8 harfe kadar uzunluk seçebilirsin. Ücretsiz ve üyeliksiz.";

export const metadata: Metadata = {
  title: "Kelimesel — Türkçe Kelime Bulmaca Oyunu | Günsel",
  description: ACIKLAMA,
  alternates: { canonical: "/kelimesel" },
  openGraph: {
    title: "Kelimesel — Günsel",
    description: "Günün gizli kelimesini bul. 3-8 harf arası, her gün yeni.",
  },
};

export default async function KelimeselPage({
  searchParams,
}: {
  searchParams: Promise<{ tarih?: string }>;
}) {
  const arsivTarihi = await resolveArsivTarihi(
    searchParams,
    getServerTodayKey(),
  );

  return (
    /* h-dvh: sayfa ekran yüksekliğine sabitleniyor ki oyun alanı kalan yeri ölçüp
       grid'i ona göre küçültebilsin (bkz. WordGrid). Eskiden min-h-screen ile içerik
       taşıyor, iPhone'da oynarken kaydırmak gerekiyordu.
       overflow-y-auto (overflow-hidden değil): normalde içerik sığdığı için kaydırma
       çubuğu çıkmaz, ama sığmadığı durumda — kısa masaüstü penceresi, mobilde klavye
       açıkken — içerik erişilemez kalmasın. overflow-hidden'ken arama kutusu ekranın
       200px altında kalıp hiç ulaşılamıyordu.
       Fragman: tanıtım metni bu kabın DIŞINDA — içine konulduğunda flex-1 olan
       oyun alanı metinle yer paylaşıyor ve oyuna çok az yer kalıyordu (ölçüldü). */
    <>
      <JsonLd
        data={oyunSemasi({
          ad: "Kelimesel",
          yol: "/kelimesel",
          aciklama: ACIKLAMA,
        })}
      />
      <div className="flex h-dvh flex-col overflow-y-auto bg-background">
        <Header />
        {arsivTarihi && <ArsivBanner tarih={arsivTarihi} />}
        <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-center gap-1.5 pt-3 pb-2 sm:pt-6 sm:pb-4">
            <h1 className="text-xl font-bold text-text-main">Kelimesel</h1>
            <HelpButton />
          </div>
          <KelimeselGameLoader arsivTarihi={arsivTarihi ?? undefined} />
          <div className="pb-2 text-center sm:pb-4">
            <Link
              href="/kelimesel/ozel/olustur"
              className="text-sm font-medium text-accent-green underline-offset-2 hover:underline"
            >
              Özel bulmaca oluştur
            </Link>
          </div>
        </main>
      </div>

      <OyunAciklamasi
        baslik="Kelimesel nasıl oynanır?"
        paragraflar={[
          "Kelimesel, her gün yenilenen Türkçe bir kelime bulmacasıdır. Gizli kelimeyi altı denemede bulmaya çalışırsın; her tahminden sonra harfler renklenir: yeşil harf doğru yerde, sarı harf kelimede var ama başka yerde, gri harf kelimede yok.",
          "Diğer kelime oyunlarından farkı, harf sayısını kendin seçebilmen: 3 harften 8 harfe kadar altı ayrı uzunluk var ve her birinin günlük kelimesi ve serisi ayrı tutulur. Kelimeler TDK Büyük Türkçe Sözlük'ten çıkarılmıştır.",
        ]}
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import Header from "@/components/Header";
import GameCard from "@/components/GameCard";
import JsonLd from "@/components/JsonLd";
import { games } from "@/data/games";
import { anaSayfaSemasi } from "@/lib/seo";
import TodayLabel from "@/components/TodayLabel";
import { SAYFA_KABI } from "@/lib/duzen";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HubPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Siteyi tanımlar + yedi oyunu Google'a sıralı liste olarak verir.
          Liste `games`'ten türüyor: yeni oyun eklenince buraya dokunmak
          gerekmiyor, kart listesiyle birlikte kendiliğinden güncelleniyor. */}
      <JsonLd data={anaSayfaSemasi(games)} />
      <Header buyukLogo />

      {/* MOBİLDE TEK SÜTUN, MASAÜSTÜNDE 3x3 (kullanıcı kararı). Kartlar görsel
          önizlemeli; mobilde alt alta tam genişlikte durunca tarayarak seçmek
          kolay, ama sekiz oyunla masaüstünde sayfa gereksiz uzuyordu.
          Kırılım noktası bilerek `lg`: `md`de (768px) üç sütun kartları
          240px'e sıkıştırıp önizlemeleri okunmaz hale getiriyor, orada iki
          sütun kalıyor. Dokuzuncu hücre yalnızca `lg`de var, çünkü 3x3'ü
          tamamlayan tek yer orası. */}
      <main className={cn(SAYFA_KABI, "flex-1 px-4 py-6")}>
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-bold text-text-main">Günsel Oyunlar</h1>
          <p className="mt-1 text-sm text-text-muted">
            <TodayLabel />
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}

          {/* Dokuzuncu hücre — 3x3'ü tamamlıyor. Link DEĞİL: tıklanacak bir yer
              yok, buton gibi görünmesi yanlış beklenti yaratır. */}
          <div
            aria-hidden="true"
            className="hidden items-center justify-center rounded-2xl border border-dashed border-border-subtle px-5 py-5 text-center lg:flex"
          >
            <span className="text-sm font-semibold text-text-muted">Çok yakında!</span>
          </div>
        </div>
        <div className="mt-5 text-center">
          <Link
            href="/arsiv"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-green underline-offset-2 hover:underline"
          >
            <History className="h-4 w-4" />
            Kaçırdığın günleri oyna
          </Link>
        </div>
      </main>

      {/* Arama motoru için gerçek içerik. Ölçüldü: bu blok eklenmeden önce ana sayfada
          toplam 212 karakter metin vardı — oyunlar tarayıcıda çizildiği için HTML'de
          neredeyse hiçbir şey yoktu ve Google böyle bir sayfayı sıralayamaz. */}
      <section className={cn(SAYFA_KABI, "px-4 pb-10")}>
        <h2 className="mb-2 text-sm font-bold text-text-main">Günsel nedir?</h2>
        <p className="mb-2 text-sm leading-relaxed text-text-muted">
          Günsel, her gün yenilenen sekiz Türkçe bulmaca oyununu bir arada sunan ücretsiz bir
          sitedir. Üyelik gerekmez; oyunlar tarayıcıda açılır ve her gün gece yarısı yeni
          bulmacalar gelir. Aynı gün herkes aynı bulmacayı oynar, sonucunu tek dokunuşla
          paylaşabilirsin.
        </p>
        <p className="mb-2 text-sm leading-relaxed text-text-muted">
          {/* Boşluk AÇIKÇA yazılıyor: bu <strong> satır başında olduğu için
              ardındaki boşluk JSX'te düşüyordu ve çıktı "Kelimeselgünün"
              oluyordu (canlıda görüldü). Satır ortasındaki diğer <strong>'lerde
              sorun yok, o yüzden yalnızca burada gerekiyor. */}
          <strong className="text-text-main">Kelimesel</strong>{" "}
          günün gizli kelimesini altı
          denemede buldurur ve harf sayısını 3&apos;ten 8&apos;e kadar seçebilirsin.{" "}
          <strong className="text-text-main">Şarkısal</strong> şarkıyı sadece ilk saniyelerinden
          tanımanı ister. <strong className="text-text-main">Harf Peteği</strong> yedi harften
          kelime türettirir. <strong className="text-text-main">Daha Az / Daha Çok</strong> iki
          değerden hangisinin büyük olduğunu sorar.{" "}
          <strong className="text-text-main">Haritasal</strong> ülkeyi siluetinden buldurur,{" "}
          <strong className="text-text-main">Bağlamsal</strong> on altı kelimeyi dört gizli gruba
          ayırmanı ister, <strong className="text-text-main">Karesel</strong> tek bir film
          karesinden filmi tahmin ettirir,{" "}
          <strong className="text-text-main">Renksel</strong> ise görselde rengi silinen bölgenin
          gerçek rengini hatırlatır.
        </p>
        <p className="text-sm leading-relaxed text-text-muted">
          Giriş yaparsan geçmiş günlerin bulmacalarını arşivden oynayabilir, istatistiklerini
          cihazlar arasında senkronlayabilirsin.
        </p>
      </section>

      <footer className="border-t border-border-subtle px-4 py-6 text-center text-xs text-text-muted">
        Günsel — her gün yeni bulmacalar.
      </footer>
    </div>
  );
}

import type { MetadataRoute } from "next";

/**
 * "Ana ekrana ekle" desteği. Günlük alışkanlık oyunlarında geri dönüşü en çok
 * artıran şey: simge ana ekranda durunca site tarayıcı sekmesi olmaktan çıkıp
 * uygulama gibi davranıyor.
 *
 * display "standalone": adres çubuğu olmadan tam ekran açılır.
 * Simge /pwa-icon rotasından 512x512 üretiliyor: icon.tsx sekme için 32x32 çiziyor,
 * kurulum istemleri ise en az 192-512 bekliyor (bildirilen boyut gerçekle uyuşmazsa
 * bazı tarayıcılar istemi hiç göstermiyor).
 * Renkler Pop görünümünün açık varyantından (bkz. globals.css) — tarayıcı
 * arayüzü de aynı krem/siyahla eşleşsin diye.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Günsel — Günlük Türkçe Bulmaca Oyunları",
    short_name: "Günsel",
    description: "Kelimesel, Şarkısal, Harf Peteği, Karesel ve Daha Az/Daha Çok. Her gün yeni bulmacalar.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "tr",
    dir: "ltr",
    background_color: "#f4f1e8",
    theme_color: "#f4f1e8",
    categories: ["games", "education", "entertainment"],
    icons: [
      { src: "/pwa-icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

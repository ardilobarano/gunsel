/**
 * Site geneli SEO sabitleri ve yapısal veri (JSON-LD) üreticileri.
 *
 * Yapısal verinin amacı: Google'ın siteyi "tarayıcıda oynanan ücretsiz oyun
 * sitesi" olarak anlaması ve arama sonucunda çıplak URL yerine kırıntı yolu
 * (Günsel › Kelimesel) göstermesi. Kırıntı, buradaki şemalar arasında arama
 * sonucunu GÖRÜNÜR biçimde değiştiren tek şey; gerisi anlama yardımcısı.
 *
 * BİLEREK EKLENMEYENLER — hepsi işe yaramaz ya da riskli:
 * - `FAQPage`: Google 2023'te SSS zengin sonuçlarını devlet/sağlık sitelerine
 *   daralttı, bizim sayfalarımızda hiç görünmez.
 * - `SearchAction` (site içi arama kutusu): sitede site geneli arama YOK.
 *   Olmayan bir özelliği işaretlemek yanlış beyandır.
 * - `aggregateRating`: gerçek bir puanlama toplamıyoruz. Uydurulmuş puan
 *   Google'ın spam politikasına aykırı ve elle işleme sebebi.
 */

/* Kanonik host WWW: apex (gunsel.app) 308 ile buraya yönleniyor. Yapısal
   verideki her URL de bu yüzden www'lu — Google'a yönlendirme arkasındaki
   adresi vermek gereksiz. */
export const SITE_URL = "https://www.gunsel.app";

/**
 * Hak sahiplerinin kaldırma talebi için iletişim adresi (altbilgide görünüyor).
 * Marka/karakter içeriği barındıran bir oyunda bu kanalın AÇIKÇA yazılı olması
 * politikanın parçası — bkz. `Footer.tsx`.
 */
export const ILETISIM_EPOSTA = "iletisim@gunsel.app";

export const SITE_BASLIK = "Günsel — Günlük Türkçe Bulmaca Oyunları";

/* Wordle/Heardle/Connections adları BİLEREK açıklamada, başlıkta değil: aranan
   kelimeler bunlar ama başkasının markasını sayfa başlığına koymak gereksiz
   risk. Oyun adlarımız ("kelimesel", "şarkısal") kimsenin aradığı kelimeler
   olmadığı için tek başına bırakılırsa sayfalar hiçbir aramada yakalanmıyor. */
export const SITE_ACIKLAMA =
  "Wordle, Heardle ve Connections tarzı yedi günlük Türkçe bulmaca oyunu: Kelimesel, Şarkısal, Harf Peteği, Daha Az/Daha Çok, Haritasal, Bağlamsal ve Karesel. Her gün yenilenir, ücretsiz ve üyeliksiz.";

/* Oyun sayfaları kendilerini bu kimlikle sitenin parçası ilan ediyor
   (`isPartOf`), böylece Google yedi ayrı sayfayı tek bir siteye bağlıyor. */
const WEBSITE_ID = `${SITE_URL}/#website`;

/** Ana sayfa: siteyi tanımlar + yedi oyunu sıralı liste olarak verir. */
export function anaSayfaSemasi(oyunlar: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "Günsel",
        url: SITE_URL,
        description: SITE_ACIKLAMA,
        inLanguage: "tr-TR",
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_URL}/#oyunlar`,
        name: "Günsel oyunları",
        numberOfItems: oyunlar.length,
        itemListElement: oyunlar.map((oyun, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: oyun.name,
          url: `${SITE_URL}${oyun.href}`,
        })),
      },
    ],
  };
}

/**
 * Oyun sayfası: uygulamanın kendisi + kırıntı yolu.
 *
 * `WebApplication` (`VideoGame` değil): oyunlar indirilen bir yapım değil,
 * tarayıcıda çalışan uygulamalar — `applicationCategory: "GameApplication"`
 * zaten oyun olduklarını söylüyor.
 * `offers` fiyatı 0: "ücretsiz" bilgisini `isAccessibleForFree`'ye ek olarak
 * makine tarafında da açıkça belirtiyor.
 */
export function oyunSemasi({
  ad,
  yol,
  aciklama,
}: {
  ad: string;
  yol: string;
  aciklama: string;
}) {
  const url = `${SITE_URL}${yol}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${url}#oyun`,
        name: ad,
        url,
        description: aciklama,
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        inLanguage: "tr-TR",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "TRY",
        },
        isPartOf: { "@id": WEBSITE_ID },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#kirinti`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Günsel",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: ad,
            item: url,
          },
        ],
      },
    ],
  };
}

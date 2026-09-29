import type { MetadataRoute } from "next";

const SITE = "https://www.gunsel.app";

/**
 * Taranmaması gerekenler:
 * - /api/     : cevap uçları; taranmasının hiçbir faydası yok
 * - /onizleme : yönetici sayfası (yarının cevapları)
 * - /tasarim  : tasarım demosu
 * - /arsiv    : giriş duvarı, tarayıcıya boş görünür
 * - /kelimesel/ozel/<kod> : kullanıcı bulmacaları. "olustur" sayfası bunun ALTINDA
 *   olduğu için ayrıca allow'lanıyor — robots.txt'te daha uzun eşleşen kural kazanır.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/kelimesel/ozel/olustur"],
        disallow: ["/api/", "/onizleme", "/tasarim", "/arsiv", "/kelimesel/ozel/"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

import type { MetadataRoute } from "next";

const SITE = "https://www.gunsel.app";

/**
 * Arama motorlarına hangi sayfaların taranacağını bildirir.
 *
 * Bilerek DIŞARIDA bırakılanlar:
 * - /onizleme  : yönetici sayfası (zaten noindex + ADMIN_EMAILS ile kapalı)
 * - /tasarim   : tasarım yönleri demosu (noindex)
 * - /arsiv     : giriş duvarı arkasında, tarayıcıya sadece giriş ekranı görünür
 * - /kelimesel/ozel/[code] : kullanıcıların ürettiği özel bulmacalar, kalıcı içerik değil
 * - /istatistikler : tamamen cihazdaki veriden üretiliyor, tarayıcı için boş sayfa
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const oyunlar = ["/kelimesel", "/sarkisal", "/harf-bahcesi", "/daha-az-cok", "/karesel", "/haritasal", "/baglamsal"];

  return [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    // İçerik her gece yarısı değiştiği için changeFrequency "daily".
    ...oyunlar.map((yol) => ({
      url: `${SITE}${yol}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    {
      url: `${SITE}/kelimesel/ozel/olustur`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
  ];
}

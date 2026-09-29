import type { NextConfig } from "next";

/**
 * Temel güvenlik başlıkları. API'lerin "incele"de görünmesini ENGELLEMEZLER (bu mümkün
 * değil) — amaçları siteyi kötüye kullanmayı zorlaştırmak:
 * - X-Frame-Options: siteyi başka bir sayfaya iframe'le gömüp tıklama hırsızlığı yapılmasını engeller.
 * - X-Content-Type-Options: tarayıcının içerik türünü tahmin etmesini kapatır.
 * - Referrer-Policy: dış sitelere tam URL sızdırmayı keser.
 * - Permissions-Policy: kamera/mikrofon/konum izinlerini kapatır (hiçbiri kullanılmıyor).
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* Bağlantı -> Bağlamsal yeniden adlandırması. Kalıcı yönlendirme şart: oyun
     yayına girdiği gün paylaşılan sonuçların içinde /baglanti linki var, onlar
     kırılmasın. */
  async redirects() {
    return [{ source: "/baglanti", destination: "/baglamsal", permanent: true }];
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Cevap/token içeren uçlar hiçbir katmanda (CDN/tarayıcı) önbelleğe alınmamalı.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};

export default nextConfig;

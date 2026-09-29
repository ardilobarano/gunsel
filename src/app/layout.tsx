import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Footer from "@/components/Footer";
import StatsSync from "@/components/StatsSync";
import { DEFAULT_SKIN, DEFAULT_THEME } from "@/lib/skin";
import { SITE_ACIKLAMA, SITE_BASLIK, SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Pop görünümünün tipografisi. latin-ext şart: ğ/ş/ı/İ/ö/ü/ç o alt kümede. */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
});

/* Kanonik host WWW: apex (gunsel.app) 308 ile buraya yönlendiriyor. metadataBase'i
   apex yapmak her og:image'ı bir yönlendirme arkasına koyuyordu — bazı önizleme
   robotları yönlendirmeyi takip etmiyor. Paylaşım metinlerinde apex kalabilir,
   insan için fark yok.
   Sabitler `src/lib/seo.ts`'te: yapısal veri (JSON-LD) de aynı metni kullanıyor,
   iki yerde tutulsa zamanla birbirinden kayarlardı. */
const SITE = SITE_URL;
const BASLIK = SITE_BASLIK;
const ACIKLAMA = SITE_ACIKLAMA;

/**
 * openGraph/twitter olmadan paylaşılan link WhatsApp'ta çıplak metin gibi duruyordu —
 * ne başlık, ne görsel, ne açıklama. Bu oyunun büyümesi tamamen paylaşıma bağlı
 * (sonuç paylaş -> arkadaş tıklar -> oynar), zincirin ortası kopuktu.
 * Görselin kendisi opengraph-image.tsx'te üretiliyor.
 *
 * metadataBase şart: olmadan Next göreli og:image yollarını mutlak URL'e çeviremez
 * ve sosyal ağlar görseli çekemez.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: BASLIK,
  description: ACIKLAMA,
  applicationName: "Günsel",
  openGraph: {
    type: "website",
    siteName: "Günsel",
    locale: "tr_TR",
    url: SITE,
    title: BASLIK,
    description: ACIKLAMA,
  },
  twitter: {
    card: "summary_large_image",
    title: BASLIK,
    description: ACIKLAMA,
  },
};

/**
 * Yakınlaştırma BİLEREK açık bırakıldı (userScalable / maximumScale kısıtlanmadı).
 * Kapatmak görme güçlüğü çekenleri sayfayı büyütemez hâle getirir (WCAG 1.4.4) ve
 * iOS Safari zaten iOS 10'dan beri bu kısıtlamayı yok sayıyor. Oyun sırasındaki asıl
 * sorun olan ÇİFT DOKUNMA zumu ise globals.css'teki touch-action ile çözüldü.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* Tarayıcı arayüzünü (iOS durum çubuğu, Android adres çubuğu) sayfa zeminiyle
     aynı renge boyar. Her iki tema için ayrı: yoksa koyu temada üstte krem bir
     şerit kalıyor. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#17161a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-background text-text-main"
        suppressHydrationWarning
      >
        {/* Görünüm + tema tercihini ilk boyamadan ÖNCE uygular — yoksa sayfa önce
            yanlış renklerle çizilip "yanıp söner".
            Görünüm anahtarı yoksa (Pop'a geçişten önceki ziyaretçiler) o görünümün
            KENDİ varsayılan teması yazılıyor: eski kullanıcıların kayıtlı "dark"
            tercihi yüzünden yeni tasarımı koyu varyantta görmelerini engelliyor. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,s=localStorage.getItem("gunsel_skin"),t;if(s!=="pop"&&s!=="klasik"){s=${JSON.stringify(DEFAULT_SKIN)};t=${JSON.stringify(DEFAULT_THEME[DEFAULT_SKIN])};localStorage.setItem("gunsel_skin",s);localStorage.setItem("gunsel_theme",t)}else{t=localStorage.getItem("gunsel_theme");if(t!=="dark"&&t!=="light")t=s==="pop"?"light":"dark"}d.dataset.skin=s;d.dataset.theme=t}catch(e){var r=document.documentElement;r.dataset.skin=${JSON.stringify(DEFAULT_SKIN)};r.dataset.theme=${JSON.stringify(DEFAULT_THEME[DEFAULT_SKIN])}}`,
          }}
        />
        {/* Giriş yapmışsa geçmişi sunucuyla senkronlar (iki yönlü, oturumda bir kez).
            Layout'ta: hangi sayfadan girilirse girilsin senkron olsun — istatistik
            sayfasına konsaydı hub'daki tamamlanma rozetleri geride kalırdı. */}
        <StatsSync />
        {children}
        <Footer />

        {/* Vercel Web Analytics — sayfa görüntülemeleri.
            Çerez KULLANMIYOR, kişisel veri toplamıyor ve parmak izi çıkarmıyor; bu
            yüzden çerez onayı gerektirmiyor (KVKK/GDPR açısından bilerek bu seçildi,
            Google Analytics yerine).
            Yol bazlı olduğu için "hangi oyun tutuyor" sorusunu zaten yanıtlıyor:
            her oyun ayrı bir adres. Özel olay takibi (ör. "oyun tamamlandı") Vercel'in
            ücretli katmanını istiyor, o yüzden şimdilik yok. */}
        <Analytics />
      </body>
    </html>
  );
}

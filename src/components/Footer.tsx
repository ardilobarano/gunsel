import Link from "next/link";
import { ILETISIM_EPOSTA } from "@/lib/seo";

/**
 * Site altbilgisi — marka/karakter içeriği için sorumluluk reddi ve kaldırma kanalı.
 *
 * NEDEN VAR: Renksel'in soruları tanınmış nesnelerin renklerini soruyor ve
 * bazıları tescilli marka. Politika (kullanıcı kararı, 2026-08-19): resmî
 * çizim/ekran görüntüsü KOPYALANMIYOR, görseller kendi şematik vektör
 * çizimlerimiz; buna ek olarak burada (1) resmî stüdyo/markalarla bağımız
 * olmadığı, (2) tüm markaların hak sahiplerine ait olduğu belirtiliyor ve
 * (3) hak sahiplerinin doğrudan ulaşabileceği bir adres veriliyor.
 *
 * Her sayfada görünüyor (layout'a bağlı) — bir alt sayfada unutulursa
 * beyanın hiç olmaması gibi bir sonuç doğardı.
 */
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border-subtle px-4 py-6 text-center text-xs leading-relaxed text-text-muted">
      <p className="mx-auto max-w-prose">
        Günsel bağımsız bir projedir; hiçbir resmî stüdyo, yayıncı ya da marka ile
        bağlantılı değildir ve onlar tarafından desteklenmemektedir. Sayfalarda geçen
        tüm marka adları, karakterler ve ticari markalar hak sahiplerine aittir.
      </p>
      <p className="mx-auto mt-2 max-w-prose">
        İçeriğin kaldırılmasını talep etmek isteyen hak sahipleri{" "}
        <a href={`mailto:${ILETISIM_EPOSTA}`} className="underline underline-offset-2">
          {ILETISIM_EPOSTA}
        </a>{" "}
        adresinden ulaşabilir; talepler değerlendirilip içerik kaldırılır.
      </p>
      <p className="mt-3">
        <Link href="/" className="underline underline-offset-2">
          Günsel
        </Link>
      </p>
    </footer>
  );
}

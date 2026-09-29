import type { NextRequest } from "next/server";

/**
 * Dış görselleri KENDİ alan adımız üzerinden geçiren vekil.
 *
 * NEDEN VAR — bu bir ürün arızasıydı, süs değil. `image.tmdb.org` kullanıcının
 * internet sağlayıcısında DNS ile engelli: adres 127.0.0.1'e çözülüyor
 * (ölçüldü; `api.themoviedb.org` de ::1'e düşüyor). Karesel'in kareleri ve
 * Daha Az/Çok'un afişleri tarayıcıdan DOĞRUDAN o adrese gittiği için aynı
 * sağlayıcıyı kullanan hiç kimse görselleri göremiyordu — oyunlar boş kare ve
 * boş kart olarak açılıyordu. Vekil sayesinde tarayıcı yalnızca gunsel.app'e
 * bağlanıyor; engellenen adrese giden tek taraf, engelden etkilenmeyen
 * sunucumuz oluyor.
 *
 * NEDEN `/api/` ALTINDA DEĞİL: `next.config.ts` tüm `/api/*` yollarına
 * `no-store` basıyor (cevap/token içeren uçlar önbelleğe girmesin diye).
 * Görseller ise tam tersine agresif önbelleklenmeli, yoksa her istek bir
 * sunucu çağrısı olur.
 *
 * AÇIK VEKİL DEĞİL: hedef alan adı istemciden gelmiyor, aşağıdaki sabit
 * listeden seçiliyor ve yol biçimi de doğrulanıyor. Aksi halde bu uç, herhangi
 * bir adresi bizim alan adımızın arkasından çekmeye yarayan bir araç olurdu.
 */

/** İzin verilen kaynaklar. Anahtar adresin ilk parçası olarak geliyor. */
const KAYNAKLAR: Record<string, { taban: string; yol: RegExp }> = {
  /* TMDB yolları içerik adresli (dosya adı hash): /t/p/<boyut>/<hash>.jpg */
  tmdb: {
    taban: "https://image.tmdb.org/t/p",
    yol: /^(w45|w92|w154|w185|w300|w342|w500|w780|w1280|original)\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/,
  },
};

/** TMDB dosya adları içeriğin hash'i — aynı ad asla farklı görsel göstermez,
 *  bu yüzden bir yıl boyunca değişmez sayılabiliyor. */
const ONBELLEK = "public, max-age=31536000, s-maxage=31536000, immutable";

export const runtime = "nodejs";

/* Bağlam tipi elle yazılıyor: `RouteContext<"/gorsel/[...yol]">` yardımcısı
   ancak `next typegen`/`next build` sonrası var oluyor, temiz bir kopyada
   `tsc --noEmit` onu bulamıyor. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ yol: string[] }> }
) {
  const { yol } = await params;
  const parcalar = yol ?? [];
  const kaynak = KAYNAKLAR[parcalar[0] ?? ""];
  const kalan = parcalar.slice(1).join("/");

  if (!kaynak || !kaynak.yol.test(kalan)) {
    return new Response("Geçersiz görsel adresi.", { status: 400 });
  }

  let cevap: Response;
  try {
    cevap = await fetch(`${kaynak.taban}/${kalan}`, {
      headers: { accept: "image/*" },
      signal: AbortSignal.timeout(10_000),
      // Sunucu tarafı önbellek: aynı görsel için kaynağa tekrar tekrar gidilmesin.
      cache: "force-cache",
    });
  } catch {
    return new Response("Görsel kaynağına ulaşılamadı.", { status: 502 });
  }

  if (!cevap.ok || !cevap.body) {
    /* Kaynak 404 derse onu aynen geçiriyoruz; başka bir hata kodunu 502'ye
       çeviriyoruz, çünkü sorun bizim tarafımızdaki erişimde demektir. */
    return new Response("Görsel bulunamadı.", { status: cevap.status === 404 ? 404 : 502 });
  }

  return new Response(cevap.body, {
    status: 200,
    headers: {
      "Content-Type": cevap.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": ONBELLEK,
      /* Boyut biliniyorsa geçiriliyor: tarayıcı ilerleme gösterebilsin. */
      ...(cevap.headers.get("content-length")
        ? { "Content-Length": cevap.headers.get("content-length")! }
        : {}),
    },
  });
}

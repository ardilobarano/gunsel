/**
 * Adı ŞİFRELİ DNS ile çözer (Cloudflare DoH) ve Node'un çözümleyicisine yamalar.
 *
 * NEDEN GEREKTİ: bu makinede `api.themoviedb.org` ve `image.tmdb.org` adresleri
 * 127.0.0.1'e çözülüyor — yani düz DNS cevabı yolda değiştiriliyor. Sorgu 8.8.8.8'e
 * yollandığında bile aynı cevap dönüyor, dolayısıyla DNS sunucusunu değiştirmek
 * çözmüyor. Şifreli DNS gerçek adresleri veriyor (3.165.239.x) ve o adrese
 * bağlanınca TMDB normal cevap veriyor, yani ENGEL SADECE İSİM ÇÖZÜMLEMESİNDE.
 *
 * Bu yalnızca YEREL GELİŞTİRME içindir: canlı site TMDB'ye Vercel sunucularından
 * eriştiği için etkilenmiyor. Kullanıcının sistem ayarlarına (hosts dosyası, ağ
 * bağdaştırıcısının DNS'i) DOKUNULMUYOR — yama yalnızca betiğin kendi sürecinde
 * geçerli, betik bitince kayboluyor.
 *
 * TLS bozulmuyor: bağlantı IP'ye kuruluyor ama sunucu adı (SNI) ve sertifika
 * doğrulaması hâlâ gerçek alan adı üzerinden yapılıyor — Node'un `lookup`
 * kancası tam da bunun için var.
 */
import dns from "node:dns";

const onbellek = new Map<string, string>();

async function dohCoz(ad: string): Promise<string | null> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(ad)}&type=A`, {
    headers: { accept: "application/dns-json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { Answer?: { type: number; data: string }[] };
  // type 1 = A kaydı; CNAME zincirindeki ara kayıtlar atlanıyor.
  const a = (data.Answer ?? []).find((x) => x.type === 1);
  return a?.data ?? null;
}

/**
 * Verilen alan adlarını şifreli DNS ile çözüp süreç içi çözümleyiciye yazar.
 * Çözülemeyen ad için yama kurulmaz, normal çözümleme devam eder.
 */
export async function dnsYamasiKur(adlar: string[]): Promise<void> {
  for (const ad of adlar) {
    const ip = await dohCoz(ad);
    if (ip) onbellek.set(ad, ip);
  }
  if (onbellek.size === 0) return;

  const asilLookup = dns.lookup;
  /* İki çağrı biçimi de destekleniyor: Node'un http/https modülü tek adres
     bekliyor, global `fetch`in altındaki undici ise `{ all: true }` ile dizi
     istiyor. Yalnızca birini karşılamak ERR_INVALID_IP_ADDRESS veriyordu. */
  // @ts-expect-error — Node'un aşırı yüklenmiş imzasıyla birebir örtüşmüyor.
  dns.lookup = function (host: string, opts: unknown, cb: unknown) {
    if (typeof opts === "function") {
      cb = opts;
      opts = {};
    }
    const ip = onbellek.get(host);
    if (ip) {
      const geriCagir = cb as (h: Error | null, a: unknown, f?: number) => void;
      const hepsi = (opts as { all?: boolean } | undefined)?.all;
      process.nextTick(() =>
        hepsi ? geriCagir(null, [{ address: ip, family: 4 }]) : geriCagir(null, ip, 4)
      );
      return;
    }
    // @ts-expect-error — dokunulmayan adlar özgün çözümleyiciye gidiyor.
    return asilLookup.call(dns, host, opts, cb);
  };

  console.log(`[dns] şifreli çözümleme: ${[...onbellek].map(([a, i]) => `${a}=${i}`).join(", ")}`);
}

/**
 * Şarkısal'ın tahmin kutusu için YEREL şarkı kataloğu üretir.
 *
 * NEDEN: arama şimdiye kadar Spotify'ı canlı proxy'liyordu ve bu artık
 * sürdürülebilir değil. Ölçüldü (Ağustos 2026):
 *   - Spotify, Development Mode'a uzun pencereli bir KOTA getirdi; dolunca
 *     arama tamamen duruyor ve `Retry-After` 15 saat gelebiliyor.
 *   - Kota uygulama başına değil GELİŞTİRİCİ HESABI başına sayılıyor, yani
 *     yeni bir uygulama açmak çözmüyor.
 *   - Genişletilmiş kota yalnızca 250 bin aylık aktif kullanıcılı kurumlara
 *     veriliyor; bizim alma ihtimalimiz yok.
 *   - Ayrıca `artist:"X"` gibi alan-kapsamlı sorgular artık en fazla 5 sonuç
 *     dönüyor — yani kota dolmasa bile canlı arama yapısal olarak zayıf.
 * Katalog bir kez toplandığında çalışma anında Spotify'a HİÇ istek gitmiyor.
 *
 * TOPLAMA YÖNTEMİ — serbest metin + sayfalama. Ölçülen alternatifler:
 *   - `/artists/{id}/top-tracks`  -> 403 Forbidden (dev mode'da kapalı)
 *   - `/albums?ids=` (toplu)      -> 403 Forbidden
 *   - `/albums/{id}/tracks`       -> çalışıyor, ~9,7 parça/çağrı ama derin
 *                                    albüm kesitleri getiriyor
 *   - serbest metin + offset      -> ~8 parça/çağrı ve ALAKA SIRASINDA
 * Sonuncusu seçildi: oyuncular meşhur şarkıları yazıyor, alaka sırası tam
 * olarak onu veriyor. `limit` en fazla 10 olabiliyor (üstü "Invalid limit").
 *
 * DAYANIKLILIK: her sanatçıdan sonra diske yazıyor ve kaldığı yerden devam
 * ediyor. Bir kere 39 şarkılık bir parti sonda çöküp tüm işi kaybettirmişti.
 *
 * Çalıştırma:
 *   npm run sarkisal:katalog              (kaldığı yerden devam eder)
 *   npm run sarkisal:katalog -- --sifirla (baştan)
 *   npm run sarkisal:katalog -- --sayfa 8 (sanatçı başına sayfa sayısı)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sanatciYol = path.join(rootDir, "src", "data", "sarkiSanatcilari.json");
const katalogYol = path.join(rootDir, "src", "data", "sarkiKatalogu.json");
const durumYol = path.join(rootDir, "src", "data", ".katalog-durum.json");

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET tanımlı değil.");
  process.exit(1);
}
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const argv = process.argv.slice(2);
const SIFIRLA = argv.includes("--sifirla");
const sayfaArg = argv.indexOf("--sayfa");
/** Sanatçı başına kaç sayfa (her sayfa 10 şarkı). */
const SAYFA_SAYISI = sayfaArg !== -1 ? Number(argv[sayfaArg + 1]) : 8;
/** Spotify dev mode'da limit üst sınırı 10 (ölçüldü). */
const LIMIT = 10;

interface Kayit {
  /** Spotify track id — /guess doğruluğu bununla ölçülüyor, zorunlu. */
  i: string;
  /** başlık */
  t: string;
  /** sanatçı(lar) */
  a: string;
}

const uyku = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Yerel ağda arada bir TLS el sıkışması düşüyor (ERR_SSL_INVALID_SESSION_ID);
   tek denemede bırakmak toplamayı yarıda kesiyordu. */
async function getir(url: string, init?: RequestInit): Promise<Response> {
  let son: unknown;
  for (let i = 0; i < 6; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      son = e;
      await uyku(500 * (i + 1));
    }
  }
  throw son;
}

let token: { deger: string; biter: number } | null = null;
async function jeton(): Promise<string> {
  if (token && token.biter > Date.now()) return token.deger;
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await getir("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token alınamadı: ${res.status}`);
  const d = (await res.json()) as { access_token: string; expires_in: number };
  token = { deger: d.access_token, biter: Date.now() + (d.expires_in - 60) * 1000 };
  return token.deger;
}

class KotaDoldu extends Error {
  constructor(readonly saniye: number) {
    super(`Spotify kotası doldu, ${Math.round(saniye / 3600)} saat sonra tekrar dene.`);
  }
}

interface Parca {
  id: string;
  name: string;
  artists: { name: string }[];
}

async function ara(q: string, offset: number): Promise<Parca[]> {
  const p = new URLSearchParams({
    q,
    type: "track",
    market: "TR",
    limit: String(LIMIT),
    offset: String(offset),
  });
  const res = await getir(`https://api.spotify.com/v1/search?${p}`, {
    headers: { Authorization: `Bearer ${await jeton()}` },
  });

  if (res.status === 429) {
    const bekle = Number(res.headers.get("Retry-After")) || 60;
    /* Kısa beklemeler normal hız sınırı, beklenir. Uzun olan KOTA demek ve
       beklemenin anlamı yok — temiz çık, ilerleme zaten diskte. */
    if (bekle > 120) throw new KotaDoldu(bekle);
    console.log(`  [429] ${bekle} sn bekleniyor...`);
    await uyku(bekle * 1000);
    return ara(q, offset);
  }
  if (!res.ok) return [];

  const d = (await res.json()) as { tracks?: { items: Parca[] } };
  return d.tracks?.items ?? [];
}

/* Spotify'ın sanatçı adı yazımı bizim listemizle harf harf uyuşmayabiliyor:
   "Kâzım Koyuncu" (şapkalı â) vs "Kazım Koyuncu", "Kardes Türküler" (ş/ç
   düşmüş) vs "Kardeş Türküler", "UZI" (ASCII I) tr-TR kuralında "uzı" olup
   "Uzi"deki "i" ile eşleşmiyor. Tam eşleşme bu yüzden Zakkum/Pinhani gibi
   düzgün adlarda bile hatalı ret üretiyordu — Türkçe'ye özgü harfleri sade
   ASCII karşılığına katlayıp öyle karşılaştırıyoruz. */
function katla(s: string): string {
  return s
    .replace(/[ıİ]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[âÂ]/g, "a")
    .replace(/[îÎ]/g, "i")
    .replace(/[ûÛ]/g, "u");
}

function normalize(s: string): string {
  return katla(s.toLocaleLowerCase("tr-TR")).replace(/\s+/g, " ").trim();
}

async function main() {
  const sanatcilar = JSON.parse(readFileSync(sanatciYol, "utf8")) as string[];

  let katalog: Kayit[] = [];
  let bitenler = new Set<string>();
  if (!SIFIRLA && existsSync(katalogYol)) {
    katalog = JSON.parse(readFileSync(katalogYol, "utf8")) as Kayit[];
    if (existsSync(durumYol)) {
      bitenler = new Set(JSON.parse(readFileSync(durumYol, "utf8")) as string[]);
    }
  }

  /* Tekilleştirme başlık+sanatçıya göre, id'ye göre DEĞİL: Spotify aynı şarkıyı
     single/albüm/derleme olarak farklı id'lerle döndürüyor ve liste tekrar
     ediyordu. */
  const anahtarlar = new Set(katalog.map((k) => `${normalize(k.t)}|${normalize(k.a)}`));

  const kaydet = () => {
    writeFileSync(katalogYol, `${JSON.stringify(katalog)}\n`);
    writeFileSync(durumYol, `${JSON.stringify([...bitenler], null, 0)}\n`);
  };

  const kalan = sanatcilar.filter((s) => !bitenler.has(s));
  console.log(
    `${sanatcilar.length} sanatçı, ${bitenler.size} tamamlanmış, ${kalan.length} kaldı. ` +
      `Katalogda ${katalog.length} şarkı var.`,
  );
  console.log(`Sanatçı başına ${SAYFA_SAYISI} sayfa x ${LIMIT} = en fazla ${SAYFA_SAYISI * LIMIT} şarkı.\n`);

  let cagri = 0;
  try {
    for (const sanatci of kalan) {
      let eklenen = 0;
      for (let sayfa = 0; sayfa < SAYFA_SAYISI; sayfa++) {
        const parcalar = await ara(sanatci, sayfa * LIMIT);
        cagri++;
        if (parcalar.length === 0) break;

        for (const p of parcalar) {
          const a = p.artists.map((x) => x.name).join(", ");
          /* Serbest metin arama alakasız sonuç da getiriyor, o yüzden sanatçı
             doğrulanıyor. TAM AD eşleşmesi aranıyor, ilk kelime DEĞİL:
             ölçüldü, ilk kelime kontrolü kısa adlarda çuvallıyordu — Uzi 0,
             Edis 0, Kazım Koyuncu 0 kayıtla kalmıştı. Kayıttaki sanatçı alanı
             çok sanatçılı olabildiği için virgülden bölünüp her parça tam
             karşılaştırılıyor. */
          const parcalar = p.artists.map((x) => normalize(x.name));
          if (!parcalar.includes(normalize(sanatci))) continue;
          const anahtar = `${normalize(p.name)}|${normalize(a)}`;
          if (anahtarlar.has(anahtar)) continue;
          anahtarlar.add(anahtar);
          katalog.push({ i: p.id, t: p.name, a });
          eklenen++;
        }
        if (parcalar.length < LIMIT) break;
      }
      bitenler.add(sanatci);
      kaydet();
      console.log(`  ${sanatci.padEnd(28)} +${String(eklenen).padStart(3)}  (toplam ${katalog.length})`);
    }
    console.log(`\n[tamamlandı] ${katalog.length} şarkı, ${cagri} Spotify çağrısı.`);
  } catch (e) {
    kaydet();
    if (e instanceof KotaDoldu) {
      console.error(`\n[durduruldu] ${e.message}`);
      console.error(`Katalogda ${katalog.length} şarkı kaydedildi. Aynı komutla kaldığı yerden devam eder.`);
      process.exit(2);
    }
    throw e;
  }

  const kb = (JSON.stringify(katalog).length / 1024).toFixed(0);
  console.log(`Dosya: src/data/sarkiKatalogu.json (${kb} KB)`);
}

main();

/**
 * Çizgi film karakterlerinin GERÇEK görsellerini indirir (kullanıcı kararı).
 *
 * NEDEN KENDİ ÇİZİMİMİZ DEĞİL: şematik çizimler denendi ve yetersiz kaldı —
 * karakterin tanınırlığı çizgilerinde, kendi şemamız onu yakalayamıyor.
 * Referans olarak gösterilen benzer oyun da gerçek kareyi kullanıyor.
 *
 * NOT — bu, daha önce yazılan "orijinal görselleri asla kullanmayın" kuralının
 * karakterler için BİLEREK esnetilmesidir; kullanıcının açık talimatı.
 * Riski azaltan diğer üç madde yürürlükte: oyun adı karakter adıyla
 * birleştirilmiyor, altbilgide resmî stüdyolarla bağ olmadığı yazılı ve
 * hak sahipleri için kaldırma kanalı var (`Footer.tsx`).
 *
 * Kaynak künyesi her indirmede `kaynak.json`'a yazılıyor — hangi görselin
 * nereden geldiği sonradan sorulabilmeli.
 *
 * Kullanım:
 *   node --import tsx scripts/renksel-karakter-indir.ts <id>="<wiki>|<Dosya adı>"
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const AJAN = "GunselRenksel/1.0 (https://gunsel.app; renksel icerik hazirligi)";
const FOTO_DIZIN = process.env.RENKSEL_FOTO_DIZINI ?? path.join("scratch", "renksel-foto");
const KAYNAK_DOSYA = path.join(FOTO_DIZIN, "kaynak.json");

/** Saydam PNG'ler bu zemine düşürülüyor — çizim şeridiyle aynı ton. */
const ZEMIN = "#f2f0ea";

interface KaynakKaydi {
  id: string;
  wiki: string;
  dosya: string;
  sayfa: string;
}

export async function karakterAra(wiki: string, sorgu: string, adet = 8): Promise<string[]> {
  const url =
    `https://${wiki}/api.php?action=query&format=json&list=search&srnamespace=6` +
    `&srlimit=${adet}&srsearch=${encodeURIComponent(sorgu)}`;
  const res = await fetch(url, { headers: { "user-agent": AJAN }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${wiki}: arama ${res.status}`);
  const veri = (await res.json()) as { query?: { search?: { title: string }[] } };
  return (veri.query?.search ?? []).map((s) => s.title.replace(/^File:/, ""));
}

async function dosyaBilgisi(wiki: string, dosya: string) {
  const url =
    `https://${wiki}/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size` +
    `&titles=${encodeURIComponent(`File:${dosya}`)}`;
  const res = await fetch(url, { headers: { "user-agent": AJAN }, signal: AbortSignal.timeout(20000) });
  const veri = (await res.json()) as {
    query?: {
      pages?: Record<string, { imageinfo?: { url: string; descriptionurl: string; width: number; height: number }[] }>;
    };
  };
  const ii = Object.values(veri.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!ii) throw new Error(`bulunamadı: ${dosya}`);
  return ii;
}

/**
 * Görseli indirip nötr zeminli, kenarında pay olan bir kareye yerleştirir.
 *
 * Saydamlık düzleştiriliyor: JPEG saydamlığı siyaha çeviriyor ve karakterin
 * çevresinde siyah bir hale kalıyordu. Pay da şart — nesne kenara yapışınca
 * maskenin taşma payı kırpılıyor.
 */
export async function karakterIndir(
  id: string,
  wiki: string,
  dosya: string,
  genislik = 900
): Promise<KaynakKaydi> {
  const bilgi = await dosyaBilgisi(wiki, dosya);
  const res = await fetch(bilgi.url, { headers: { "user-agent": AJAN }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`indirilemedi (${res.status}): ${dosya}`);
  const ham = Buffer.from(await res.arrayBuffer());

  const icerik = await sharp(ham)
    .resize({ width: Math.round(genislik * 0.72), height: Math.round(genislik * 0.6), fit: "inside" })
    .png()
    .toBuffer();
  const boyut = await sharp(icerik).metadata();
  const yukseklik = Math.max(Math.round(genislik * 0.56), (boyut.height ?? 0) + Math.round(genislik * 0.12));

  await mkdir(FOTO_DIZIN, { recursive: true });
  await sharp({ create: { width: genislik, height: yukseklik, channels: 3, background: ZEMIN } })
    .composite([{ input: icerik, gravity: "center" }])
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toFile(path.join(FOTO_DIZIN, `${id}.jpg`));

  return { id, wiki, dosya, sayfa: bilgi.descriptionurl };
}

async function main() {
  const istekler = process.argv.slice(2).map((p) => {
    const [id, ...rest] = p.split("=");
    const [wiki, dosya] = rest.join("=").split("|");
    return { id, wiki, dosya };
  });
  if (!istekler.length) {
    console.error('Kullanım: renksel-karakter-indir.ts <id>="<wiki>|<Dosya adı>"');
    process.exit(1);
  }

  let kayitlar: KaynakKaydi[] = [];
  try {
    kayitlar = JSON.parse(await readFile(KAYNAK_DOSYA, "utf8")) as KaynakKaydi[];
  } catch { /* ilk çalıştırma */ }

  for (const i of istekler) {
    try {
      const k = await karakterIndir(i.id, i.wiki, i.dosya);
      kayitlar = kayitlar.filter((x) => x.id !== k.id).concat(k);
      console.log(`${k.id.padEnd(20)} ${k.dosya.slice(0, 52)}`);
    } catch (e) {
      console.log(`${i.id.padEnd(20)} HATA: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  await writeFile(KAYNAK_DOSYA, JSON.stringify(kayitlar, null, 2), "utf8");
  console.log(`\nKaynak künyesi: ${KAYNAK_DOSYA} (${kayitlar.length} görsel)`);
}

if (process.argv[1]?.includes("renksel-karakter-indir")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

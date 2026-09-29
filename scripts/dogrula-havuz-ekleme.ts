/**
 * Havuz büyütmesinin GEÇMİŞİ BOZMADIĞINI doğrular.
 *
 * Ölçtükleri:
 *   1. Yeni dosyanın ilk N kaydı git'teki eski dosyayla birebir aynı mı?
 *      Aynı değilse "tarihten itibaren büyüme" hilesi geçersiz — eski günler
 *      eski indeksi kullansa bile o indekste artık başka bir kayıt olurdu.
 *   2. Kesim tarihinden ÖNCEKİ günlerde GERÇEK seçim fonksiyonu, büyütmeden
 *      önceki seçimle aynı kaydı mı veriyor?
 *   3. Kesim sonrası yeni kayıtlara ulaşılıyor mu ve ilk tekrar kaçıncı günde?
 *
 * Seçim fonksiyonu dışarıdan veriliyor (import değil): oyun dosyalarının bir
 * kısmı `server-only` taşıyor ve script'ten import edilemiyor (bkz. CLAUDE.md).
 *
 * Çalıştırma: node --import tsx scripts/dogrula-havuz-ekleme.ts <oyun>
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { turluIndeks, hashString } from "../src/lib/havuzBuyumesi";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

interface Oyun {
  dosya: string;
  eskiBoyut: number;
  kesimTarihi: string;
  /**
   * Büyütmeden ÖNCE kullanılan seçim ve şu an kodda olan seçim.
   *
   * İkisi de OPSİYONEL: Bağlamsal'ın eski seçimi `DAILY_SELECTION_SECRET` ile
   * HMAC'lendiği için script'ten yeniden üretilemiyor. O oyunlarda yalnızca
   * "ilk N kayıt korunmuş mu" kontrolü yapılabiliyor — ki asıl kritik olan da o,
   * çünkü kesim tarihi mantığı ancak ön ek bozulmadıysa anlamlı.
   */
  eskiSecim?: (tarih: string) => number;
  yeniSecim?: (tarih: string, boyut: number) => number;
}

const OYUNLAR: Record<string, Oyun> = {
  harfBahcesi: {
    dosya: "harfBahcesiPuzzles.json",
    eskiBoyut: 50,
    kesimTarihi: "2026-08-09",
    eskiSecim: (t) => hashString(`harfBahcesi-${t}`) % 50,
    yeniSecim: (t, boyut) =>
      t < "2026-08-09"
        ? hashString(`harfBahcesi-${t}`) % 50
        : turluIndeks(t, boyut, "harfBahcesi", "2026-08-09"),
  },
  /* Bağlamsal'ın kesim ÖNCESİ seçimi HMAC'li (getDailyIndex) olduğu için
     yeniden üretilemiyor -> eskiSecim yok, karşılaştırma atlanıyor. Kesim
     SONRASI turlu gezinme olduğu için kapsama/tekrar ölçümü yapılabiliyor. */
  baglamsal: {
    dosya: "baglamsalPuzzles.json",
    eskiBoyut: 26,
    kesimTarihi: "2026-08-09",
    yeniSecim: (t, boyut) => turluIndeks(t, boyut, "baglamsal", "2026-08-09"),
  },
};

const oyunAdi = process.argv[2];
const oyun = OYUNLAR[oyunAdi];
if (!oyun) {
  console.error(
    `Bilinmeyen oyun: ${oyunAdi}. Seçenekler: ${Object.keys(OYUNLAR).join(", ")}`,
  );
  process.exit(1);
}

const yeni = JSON.parse(
  readFileSync(path.join(rootDir, "src", "data", oyun.dosya), "utf8"),
) as unknown[];
const eski = JSON.parse(
  execFileSync("git", ["show", `HEAD:src/data/${oyun.dosya}`], {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
) as unknown[];

console.log(`${oyun.dosya}: eski ${eski.length} -> yeni ${yeni.length} kayıt`);

let hata = 0;

// 1. Ön ek korunmuş mu?
if (eski.length !== oyun.eskiBoyut) {
  console.log(
    `  !! git'teki dosyada ${eski.length} kayıt var, beklenen ${oyun.eskiBoyut}`,
  );
  hata++;
}
const bozuk: number[] = [];
for (let i = 0; i < Math.min(eski.length, yeni.length); i++) {
  if (JSON.stringify(eski[i]) !== JSON.stringify(yeni[i])) bozuk.push(i);
}
if (bozuk.length) {
  console.log(
    `  !! ilk ${eski.length} kayıttan ${bozuk.length} tanesi DEĞİŞMİŞ (ör. ${bozuk.slice(0, 8).join(", ")})`,
  );
  hata++;
} else {
  console.log(`  ilk ${eski.length} kayıt birebir korunmuş`);
}

function gunEkle(tarih: string, gun: number): string {
  const d = new Date(`${tarih}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

// 2. Kesim öncesi GERÇEK seçim değişmemiş mi?
const { eskiSecim, yeniSecim } = oyun;
if (!eskiSecim || !yeniSecim) {
  console.log(
    "  (seçim karşılaştırması atlandı: bu oyunun eski seçimi HMAC'li, script'ten üretilemiyor)",
  );
} else {
  const degisen: string[] = [];
  for (let g = -200; g < 0; g++) {
    const tarih = gunEkle(oyun.kesimTarihi, g);
    if (yeniSecim(tarih, yeni.length) !== eskiSecim(tarih)) degisen.push(tarih);
  }
  if (degisen.length) {
    console.log(
      `  !! kesim öncesi ${degisen.length}/200 günde seçim DEĞİŞTİ (ör. ${degisen.slice(0, 5).join(", ")})`,
    );
    hata++;
  } else {
    console.log("  kesim öncesi 200 gün: seçim birebir aynı");
  }
}

// 3. Kesim sonrası kapsama ve ilk tekrar.
const gorulen = new Map<number, number>();
if (!yeniSecim) {
  console.log("  (kapsama ölçümü atlandı: yeniSecim tanımlı değil)");
  console.log(hata === 0 ? "\nGEÇTİ" : `\n${hata} SORUN`);
  process.exit(hata === 0 ? 0 : 1);
}
/* İki ayrı sayı, karıştırılmasın:
   - ilkTekrarGunu: kesimden kaç gün sonra İLK kez bir tekrar yaşandı (oyuncunun
     "bunu görmüştüm" diyeceği ilk an).
   - enKisaAralik: aynı kaydın iki görülüşü arasındaki en kısa mesafe. */
let ilkTekrarGunu: number | null = null;
let enKisaAralik = Infinity;
for (let g = 0; g < yeni.length * 2; g++) {
  const tarih = gunEkle(oyun.kesimTarihi, g);
  const i = yeniSecim(tarih, yeni.length);
  if (!Number.isInteger(i) || i < 0 || i >= yeni.length) {
    console.log(`  !! ${tarih} için indeks havuz dışında: ${i}`);
    hata++;
    break;
  }
  if (gorulen.has(i)) {
    if (ilkTekrarGunu === null) ilkTekrarGunu = g;
    enKisaAralik = Math.min(enKisaAralik, g - gorulen.get(i)!);
  }
  gorulen.set(i, g);
}
const yeniBolge = [...gorulen.keys()].filter((i) => i >= oyun.eskiBoyut).length;
console.log(
  `  kesim sonrası ${yeni.length * 2} günde ${gorulen.size}/${yeni.length} kayıt kullanıldı (${yeniBolge} tanesi yeni bölgeden)`,
);
console.log(
  ilkTekrarGunu === null
    ? `  ilk tekrar: ${yeni.length * 2} günde hiç olmadı`
    : `  ilk tekrar ${ilkTekrarGunu}. günde, en kısa tekrar aralığı ${enKisaAralik} gün`,
);
if (yeniBolge === 0) {
  console.log("  !! yeni kayıtlara hiç ulaşılmıyor");
  hata++;
}

console.log(hata === 0 ? "\nGEÇTİ" : `\n${hata} SORUN`);
process.exit(hata === 0 ? 0 : 1);

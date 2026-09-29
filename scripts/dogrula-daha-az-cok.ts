/**
 * Daha Az/Çok havuzlarını denetler.
 *
 * Bu oyunda veri hatası SESSİZ: yanlış bir rakam oyunu çökertmez, sadece doğru
 * cevabı yanlış yapar ve oyuncu neden kaybettiğini anlamaz. Bu yüzden veri
 * eklendikçe makineyle kontrol ediliyor.
 *
 * Kontroller:
 *   1. Tekrarlı id (aynı öğe iki kez -> "X mi X mi?" karşılaştırması).
 *   2. Birim grubu CHAIN_LENGTH'ten küçük olmamalı — küçükse o grup hiç
 *      kullanılamaz, sessizce ölü veri olur.
 *   3. YAKIN ÇİFTLER: aynı birimdeki iki değer birbirine %2'den yakınsa o
 *      karşılaştırma yazı-turaya döner. Tam eşitlik SORUN DEĞİL (oyun eşitliği
 *      her iki yönde de doğru sayıyor), asıl kötü olan "az farkla yanlış".
 *   4. Negatif değer — kart gösterimi ve "daha büyük" mantığı pozitif varsayıyor.
 *
 * Çalıştırma: node --import tsx scripts/dogrula-daha-az-cok.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const CHAIN_LENGTH = 6;
/** Bu orandan yakın çiftler yazı-tura sayılıyor (tam eşitlik hariç). */
const YAKIN_ESIK = 0.02;

interface Oge {
  id: string;
  label: string;
  value: number;
  unit: string;
}

const DOSYALAR = [
  "dahaAzCokNufus.json",
  "dahaAzCokFilm.json",
  "dahaAzCokDizi.json",
  "dahaAzCokFiyat.json",
  "dahaAzCokTrivia.json",
];

let toplamHata = 0;
let toplamUyari = 0;

for (const dosya of DOSYALAR) {
  const ogeler = JSON.parse(
    readFileSync(path.join(rootDir, "src", "data", dosya), "utf8"),
  ) as Oge[];

  console.log(`\n=== ${dosya} (${ogeler.length} öğe) ===`);

  // 1. Tekrarlı id
  const sayac = new Map<string, number>();
  for (const o of ogeler) sayac.set(o.id, (sayac.get(o.id) ?? 0) + 1);
  const tekrarli = [...sayac].filter(([, n]) => n > 1);
  if (tekrarli.length) {
    console.log(`  HATA tekrarlı id: ${tekrarli.map(([id]) => id).join(", ")}`);
    toplamHata++;
  }

  // 4. Negatif değer
  const negatif = ogeler.filter((o) => o.value < 0);
  if (negatif.length) {
    console.log(`  HATA negatif değer: ${negatif.map((o) => o.label).join(", ")}`);
    toplamHata++;
  }

  // 2 + 3. Birim grupları
  const gruplar = new Map<string, Oge[]>();
  for (const o of ogeler) {
    const g = gruplar.get(o.unit);
    if (g) g.push(o);
    else gruplar.set(o.unit, [o]);
  }

  for (const [birim, grup] of [...gruplar].sort((a, b) => a[0].localeCompare(b[0], "tr"))) {
    const yakin: string[] = [];
    const sirali = [...grup].sort((a, b) => a.value - b.value);
    for (let i = 1; i < sirali.length; i++) {
      const a = sirali[i - 1];
      const b = sirali[i];
      if (a.value === b.value) continue; // tam eşitlik sorun değil
      const buyuk = Math.max(Math.abs(a.value), Math.abs(b.value));
      if (buyuk === 0) continue;
      const oran = (b.value - a.value) / buyuk;
      if (oran < YAKIN_ESIK) {
        yakin.push(`${a.label} (${a.value}) ~ ${b.label} (${b.value}) — %${(oran * 100).toFixed(1)}`);
      }
    }

    const durum = grup.length < CHAIN_LENGTH ? "KULLANILAMAZ" : "ok";
    console.log(`  ${birim.padEnd(12)} ${String(grup.length).padStart(3)} öğe  ${durum}`);
    if (grup.length < CHAIN_LENGTH) {
      console.log(`     HATA: ${CHAIN_LENGTH} öğeden az, bu grup hiç seçilemez`);
      toplamHata++;
    }
    for (const y of yakin) {
      console.log(`     uyarı yakın çift: ${y}`);
      toplamUyari++;
    }
  }
}

/**
 * Asıl ölçüm: oyuncunun GERÇEKTEN gördüğü karşılaştırmalar ne kadar adil?
 *
 * Yukarıdaki "yakın çift" listesi tek başına yanıltıcı — Film/Dizi'de puanlar
 * 0,1 aralıklı olduğu için her komşu çift otomatik olarak %1,2 farkla uyarı
 * üretiyor. Önemli olan, günün 6'lı zincirinde ARDIŞIK iki öğenin (yani gerçekten
 * karşılaştırılan çiftin) ne sıklıkla yazı-turaya dönüştüğü.
 *
 * Günün zinciri havuzun rastgele karılmasıyla seçildiği için burada da rastgele
 * örneklem alınıyor; oyunun kendi seçim fonksiyonu import EDİLMİYOR çünkü
 * `server-only` taşıyor (bkz. CLAUDE.md).
 */
console.log("\n\n=== Günlük zincirlerde yazı-tura oranı (10.000 örneklem) ===");
console.log("(ardışık çiftin farkı %2'nin altındaysa 'yazı-tura' sayılıyor)\n");

const ORNEKLEM = 10000;
for (const dosya of DOSYALAR) {
  const ogeler = JSON.parse(
    readFileSync(path.join(rootDir, "src", "data", dosya), "utf8"),
  ) as Oge[];

  const gruplar = new Map<string, Oge[]>();
  for (const o of ogeler) {
    const g = gruplar.get(o.unit);
    if (g) g.push(o);
    else gruplar.set(o.unit, [o]);
  }
  const uygun = [...gruplar.values()].filter((g) => g.length >= CHAIN_LENGTH);

  let zincirdeYaziTura = 0;
  let toplamKarsilastirma = 0;
  let yaziTuraKarsilastirma = 0;

  for (let n = 0; n < ORNEKLEM; n++) {
    const grup = uygun[Math.floor(Math.random() * uygun.length)];
    const karisik = [...grup];
    for (let i = karisik.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [karisik[i], karisik[j]] = [karisik[j], karisik[i]];
    }
    /* dahaAzCok.server.ts'teki ayrikZincirSec ile aynı mantık (server-only
       olduğu için import edilemiyor, bilinçli küçük duplication). */
    const zincir: Oge[] = [];
    for (const oge of karisik) {
      const onceki = zincir[zincir.length - 1];
      const buyuk = onceki ? Math.max(Math.abs(onceki.value), Math.abs(oge.value)) : 0;
      const ayri =
        !onceki ||
        (buyuk === 0
          ? onceki.value !== oge.value
          : Math.abs(onceki.value - oge.value) / buyuk >= YAKIN_ESIK);
      if (ayri) {
        zincir.push(oge);
        if (zincir.length === CHAIN_LENGTH) break;
      }
    }
    const secilenler = new Set(zincir);
    for (const oge of karisik) {
      if (zincir.length === CHAIN_LENGTH) break;
      if (!secilenler.has(oge)) zincir.push(oge);
    }
    let bulasik = false;
    for (let i = 1; i < zincir.length; i++) {
      const a = zincir[i - 1].value;
      const b = zincir[i].value;
      toplamKarsilastirma++;
      const buyuk = Math.max(Math.abs(a), Math.abs(b));
      const oran = buyuk === 0 ? 0 : Math.abs(b - a) / buyuk;
      // Tam eşitlik oyunda doğru sayılıyor, yazı-tura değil.
      if (a !== b && oran < YAKIN_ESIK) {
        yaziTuraKarsilastirma++;
        bulasik = true;
      }
    }
    if (bulasik) zincirdeYaziTura++;
  }

  const kategori = dosya.replace("dahaAzCok", "").replace(".json", "");
  console.log(
    `  ${kategori.padEnd(7)} zincirlerin %${((zincirdeYaziTura / ORNEKLEM) * 100).toFixed(1)}'inde en az bir yazı-tura, ` +
      `karşılaştırmaların %${((yaziTuraKarsilastirma / toplamKarsilastirma) * 100).toFixed(1)}'i yazı-tura`,
  );
}

console.log(
  `\n${toplamHata} hata, ${toplamUyari} yakın çift uyarısı (çoğu Film/Dizi'nin 0,1'lik puan adımından, bkz. yukarıdaki oran)`,
);
process.exit(toplamHata === 0 ? 0 : 1);

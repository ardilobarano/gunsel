/**
 * Bağlamsal bulmacalarını denetler.
 *
 * NEDEN VAR: bu oyunun bulmacaları elle yazılıyor ve hatası SESSİZ — bozuk bir
 * bulmaca çökmez, sadece çözülemez hâle gelir. Bir keresinde 26 bulmacanın
 * 14'ünde mor kategori anlamsal olarak bozuktu (ör. "AYNI ZAMANDA BİR RENK"
 * grubunda TURUNCU vardı, ki kendisi zaten bir renk) ve bunu ancak kullanıcı
 * fark etti. Aşağıdaki kontroller o sınıftaki hataların YAPISAL olanlarını
 * yakalar.
 *
 * DİKKAT: bu script anlamı denetleyemez. "KUŞ satranç taşıdır" gibi bir hata
 * buradan geçer. Yeni bulmaca yazıldığında her grubun her kelimesi ayrıca elle
 * okunmalı — özellikle mor grupta, çünkü orada iddia edilen çifte anlamın
 * gerçekten var olması gerekiyor.
 *
 * Çalıştırma: node --import tsx scripts/dogrula-baglamsal.ts [dosya.json]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

interface Grup {
  name: string;
  level: number;
  words: string[];
}
interface Bulmaca {
  id: string;
  groups: Grup[];
}

const dosya = process.argv[2] ?? path.join(rootDir, "src", "data", "baglamsalPuzzles.json");
const bulmacalar = JSON.parse(readFileSync(dosya, "utf8")) as Bulmaca[];

/* Izgara 4x4 ve mobilde dar: uzun kelime kutuya sığmıyor, boşluklu kelime iki
   satıra bölünüyor. Mevcut bulmacalarda en uzun kelime 11 harf. */
const MAKS_UZUNLUK = 12;

let hata = 0;
const hatalar: string[] = [];
function bildir(id: string, mesaj: string) {
  hatalar.push(`  ${id}: ${mesaj}`);
  hata++;
}

const gorulenIdler = new Set<string>();
const kelimeSayaci = new Map<string, string[]>();

for (const b of bulmacalar) {
  if (gorulenIdler.has(b.id)) bildir(b.id, "tekrar eden id");
  gorulenIdler.add(b.id);

  if (b.groups.length !== 4) {
    bildir(b.id, `4 grup olmalı, ${b.groups.length} var`);
    continue;
  }

  const seviyeler = b.groups.map((g) => g.level).sort();
  if (seviyeler.join(",") !== "0,1,2,3") {
    bildir(b.id, `seviyeler 0-3 olmalı, bulunan: ${seviyeler.join(",")}`);
  }

  const tumKelimeler: string[] = [];
  for (const g of b.groups) {
    if (g.words.length !== 4) {
      bildir(b.id, `"${g.name}" grubunda ${g.words.length} kelime var, 4 olmalı`);
    }
    if (!g.name || g.name.trim() === "") bildir(b.id, "grup adı boş");
    for (const k of g.words) {
      tumKelimeler.push(k);
      if (k !== k.toLocaleUpperCase("tr-TR")) {
        bildir(b.id, `"${k}" büyük harfle yazılmamış`);
      }
      if (k.includes(" ")) {
        bildir(b.id, `"${k}" boşluk içeriyor (ızgara kutusuna sığmaz)`);
      }
      if (k.length > MAKS_UZUNLUK) {
        bildir(b.id, `"${k}" ${k.length} harf, en fazla ${MAKS_UZUNLUK} olmalı`);
      }
    }
  }

  /* EN ÖNEMLİ KONTROL: aynı kelime iki grupta olamaz. Olursa bulmacanın tek bir
     doğru çözümü kalmaz — oyuncu doğru grubu seçse bile sunucu eşleştiremez. */
  const benzersiz = new Set(tumKelimeler);
  if (benzersiz.size !== tumKelimeler.length) {
    const tekrarli = tumKelimeler.filter((k, i) => tumKelimeler.indexOf(k) !== i);
    bildir(b.id, `AYNI KELİME BİRDEN FAZLA GRUPTA: ${[...new Set(tekrarli)].join(", ")}`);
  }

  for (const k of benzersiz) {
    const liste = kelimeSayaci.get(k) ?? [];
    liste.push(b.id);
    kelimeSayaci.set(k, liste);
  }
}

console.log(`${bulmacalar.length} bulmaca denetlendi.\n`);
if (hatalar.length) {
  console.log("HATALAR:");
  for (const h of hatalar) console.log(h);
} else {
  console.log("Yapısal hata yok.");
}

/* Çeşitlilik: aynı kelime çok fazla bulmacada geçiyorsa oyun tekrara düşüyor. */
const sikKullanilan = [...kelimeSayaci]
  .filter(([, ids]) => ids.length >= 3)
  .sort((a, b) => b[1].length - a[1].length);
if (sikKullanilan.length) {
  console.log(`\n3+ bulmacada geçen kelimeler (çeşitlilik uyarısı):`);
  for (const [k, ids] of sikKullanilan.slice(0, 15)) {
    console.log(`  ${k.padEnd(12)} ${ids.length} kez  (${ids.join(", ")})`);
  }
}

console.log(`\n${hata} yapısal hata`);
console.log(
  "NOT: anlamsal doğruluk (kelime gerçekten o gruba ait mi) bu script'le ÖLÇÜLMEZ.",
);
process.exit(hata === 0 ? 0 : 1);

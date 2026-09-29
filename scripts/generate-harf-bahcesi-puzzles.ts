/**
 * TDK tabanlı kelime listesinden (src/data/targetWords.json) Harf Bahçesi
 * (Spelling Bee) için iyi 7-harf + merkez harf kombinasyonları çıkarır.
 *
 * Mantık: "pangram" olabilecek (tam olarak 7 farklı harften oluşan) kelimeleri
 * aday harf kümesi (S) olarak alır. Her S için, S'nin harfleriyle yazılabilen
 * (4+ harfli, S'nin herhangi bir alt kümesi) TÜM kelimeleri bulur, ardından
 * S içindeki her harfi merkez harf adayı olarak deneyip en çok kullanılabilir
 * kelime veren (merkez harfi içeren) kombinasyonu seçer. Sonucu 15-45 geçerli
 * kelime aralığında olan, en iyi ~50 bulmacayı src/data/harfBahcesiPuzzles.json'a yazar.
 *
 * Performans: her kelimenin harf kümesi Türkçe 29 harflik alfabede bir bit
 * maskesine (number) çevrilir — alt küme kontrolü (word & ~anchor) === 0 ile
 * O(1) yapılır, Set/string karşılaştırması yerine.
 *
 * Çalıştırma: node --import tsx scripts/generate-harf-bahcesi-puzzles.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const TR_LOCALE = "tr-TR";
function trUpper(value: string): string {
  return value.toLocaleUpperCase(TR_LOCALE);
}

const ALPHABET = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ";
const BIT_INDEX = new Map<string, number>([...ALPHABET].map((ch, i) => [ch, i]));

function popcount(mask: number): number {
  let count = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    count++;
  }
  return count;
}

function wordMask(word: string): number | null {
  let mask = 0;
  for (const ch of word) {
    const bit = BIT_INDEX.get(ch);
    if (bit === undefined) return null; // beklenmedik karakter (rakam vb.) -> atla
    mask |= 1 << bit;
  }
  return mask;
}

const MIN_WORD_LENGTH = 4;
const MIN_VALID_WORDS = 15;
const MAX_VALID_WORDS = 45;
/* 50'den 250'ye çıkarıldı: günde bir bulmaca tüketiliyor, 50 havuz ~7 haftada
   başa sarıyordu. Adaylar hâlâ "25 kelimeye yakınlık"a göre sıralı, yani ilk
   50 aynı kalıyor — sadece arkasına daha uzak zorluktakiler ekleniyor.
   `--say N` ile geçilebilir. */
const sayArg = process.argv.indexOf("--say");
const TARGET_PUZZLE_COUNT =
  sayArg !== -1 ? Number(process.argv[sayArg + 1]) : 250;
if (!Number.isFinite(TARGET_PUZZLE_COUNT) || TARGET_PUZZLE_COUNT < 1) {
  /* Sessizce boş dosya yazmasın: --say yanlış verildiğinde slice(0, NaN) boş
     dizi döndürüp havuzu siliyordu (bir kere oldu). */
  console.error(`--say geçersiz: ${process.argv[sayArg + 1]}`);
  process.exit(1);
}

const dataDir = join(process.cwd(), "src", "data");
const targetWords = JSON.parse(readFileSync(join(dataDir, "targetWords.json"), "utf8")) as Record<
  string,
  string[]
>;

const corpus: string[] = [];
for (const [length, words] of Object.entries(targetWords)) {
  if (Number(length) < MIN_WORD_LENGTH) continue;
  corpus.push(...words);
}

interface Entry {
  word: string;
  mask: number;
}

const fittingWords: Entry[] = [];
for (const raw of corpus) {
  const word = trUpper(raw);
  const mask = wordMask(word);
  if (mask === null) continue;
  if (popcount(mask) <= 7) fittingWords.push({ word, mask });
}

console.log(`Toplam kelime: ${corpus.length}, 7 harfe sığabilen: ${fittingWords.length}`);

// Pangram adayları: tam olarak 7 farklı harften oluşan kelimelerin maskeleri.
const anchorMasks = new Set<number>();
for (const { mask } of fittingWords) {
  if (popcount(mask) === 7) anchorMasks.add(mask);
}

console.log(`Benzersiz aday 7-harf kümesi (pangram'dan): ${anchorMasks.size}`);

interface PuzzleCandidate {
  letters: string[];
  centerLetter: string;
  validWords: string[];
  pangrams: string[];
  score: number;
}

const candidates: PuzzleCandidate[] = [];
let processed = 0;

for (const anchorMask of anchorMasks) {
  processed++;
  if (processed % 500 === 0) console.log(`  ...${processed}/${anchorMasks.size} işlendi`);

  const wordsFittingSet = fittingWords.filter((e) => (e.mask & ~anchorMask) === 0);
  if (wordsFittingSet.length < MIN_VALID_WORDS) continue;

  const lettersArr = [...ALPHABET].filter((ch) => (anchorMask & (1 << BIT_INDEX.get(ch)!)) !== 0);

  let best: { center: string; words: Entry[] } | null = null;
  for (const center of lettersArr) {
    const centerBit = 1 << BIT_INDEX.get(center)!;
    const words = wordsFittingSet.filter((e) => (e.mask & centerBit) !== 0);
    if (!best || words.length > best.words.length) best = { center, words };
  }

  if (!best) continue;
  if (best.words.length < MIN_VALID_WORDS || best.words.length > MAX_VALID_WORDS) continue;

  const pangrams = best.words.filter((e) => e.mask === anchorMask).map((e) => e.word);
  if (pangrams.length === 0) continue;

  candidates.push({
    letters: lettersArr,
    centerLetter: best.center,
    validWords: best.words.map((e) => e.word).sort(),
    pangrams: pangrams.sort(),
    score: best.words.length,
  });
}

console.log(
  `Kriterlere uyan (${MIN_VALID_WORDS}-${MAX_VALID_WORDS} kelime, en az 1 pangram) aday: ${candidates.length}`
);

candidates.sort((a, b) => Math.abs(a.score - 25) - Math.abs(b.score - 25));

const finalPuzzles = candidates
  .slice(0, TARGET_PUZZLE_COUNT)
  .map(({ letters, centerLetter, validWords, pangrams }) => ({ letters, centerLetter, validWords, pangrams }));

console.log(`Yazılan bulmaca sayısı: ${finalPuzzles.length}`);

/* Zorluk dağılımı: havuz büyüdükçe "25 kelimeye yakınlık" sırasının kuyruğuna
   daha kolay/zor bulmacalar giriyor. Uçlar oyunu bozacak kadar açılmasın diye
   ölçülüyor (kelime sayısı = o günün yapılabilecek iş miktarı). */
const sayilar = finalPuzzles.map((p) => p.validWords.length).sort((a, b) => a - b);
const yuzdelik = (y: number) => sayilar[Math.floor((sayilar.length - 1) * y)];
console.log(
  `Kelime sayısı dağılımı: min ${sayilar[0]}, %25 ${yuzdelik(0.25)}, ortanca ${yuzdelik(0.5)}, %75 ${yuzdelik(0.75)}, maks ${sayilar[sayilar.length - 1]}`,
);
const pangramlar = finalPuzzles.map((p) => p.pangrams.length);
console.log(
  `Pangram sayısı: ortalama ${(pangramlar.reduce((a, b) => a + b, 0) / pangramlar.length).toFixed(1)}, en fazla ${Math.max(...pangramlar)}`,
);

writeFileSync(join(dataDir, "harfBahcesiPuzzles.json"), JSON.stringify(finalPuzzles, null, 2) + "\n");

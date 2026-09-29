import puzzlesData from "@/data/harfBahcesiPuzzles.json";
import { turluIndeks } from "./havuzBuyumesi";
import { trUpper } from "./utils";

export interface HarfBahcesiPuzzle {
  letters: string[];
  centerLetter: string;
  validWords: string[];
  pangrams: string[];
}

const puzzles = puzzlesData as HarfBahcesiPuzzle[];

export const GAME_ID = "harfBahcesi";

export const MIN_WORD_LENGTH = 4;
export const PANGRAM_BONUS = 7;

/** NYT Spelling Bee tarzı seviye adları, maksimum puanın yüzdesine göre. */
export const RANKS: { label: string; threshold: number }[] = [
  { label: "Acemi", threshold: 0 },
  { label: "İyi Başlangıç", threshold: 0.02 },
  { label: "Yükseliyor", threshold: 0.05 },
  { label: "İyi", threshold: 0.08 },
  { label: "Sağlam", threshold: 0.15 },
  { label: "Güzel", threshold: 0.25 },
  { label: "Harika", threshold: 0.4 },
  { label: "Muhteşem", threshold: 0.5 },
  { label: "Dahi", threshold: 0.7 },
  { label: "Kraliçe Arı", threshold: 1 },
];

/** Hub kartındaki tik rozeti için: bu seviyeye ulaşınca gün "tamamlandı" sayılır. */
export const COMPLETION_RANK_LABEL = "Dahi";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Havuz 50'den 250'ye çıkarıldı ve seçim deseni turlu gezinmeye geçti.
 *
 * Bu tarihten ÖNCEKİ günler eski seçimde bırakıldı (ilk 50 kayıt + eski hash
 * deseni): havuz büyüdüğünde `% n`'in tabanı değiştiği için geçmiş günlerin
 * bulmacası da değişirdi — arşivden tekrar oynayan biri o gün oynadığından
 * başkasını görürdü ve o an devam eden oyunda harfler değişirdi.
 *
 * Bu tarihten SONRA turlu gezinme (bkz. havuzBuyumesi.ts): eski desende 250'lik
 * havuzda bile ilk tekrar 76. günde geliyordu, turlu gezinmede 250. günden önce
 * hiçbir bulmaca tekrar etmiyor.
 */
const BUYUME_TARIHI = "2026-08-09";
const ESKI_HAVUZ_BOYUTU = 50;

export function getDailyPuzzle(dateKey: string): HarfBahcesiPuzzle {
  if (dateKey < BUYUME_TARIHI) {
    return puzzles[
      hashString(`harfBahcesi-${dateKey}`) % ESKI_HAVUZ_BOYUTU
    ];
  }
  return puzzles[
    turluIndeks(dateKey, puzzles.length, "harfBahcesi", BUYUME_TARIHI)
  ];
}

export function isPangram(word: string, puzzle: HarfBahcesiPuzzle): boolean {
  const distinct = new Set(trUpper(word).split(""));
  return distinct.size === puzzle.letters.length && puzzle.letters.every((l) => distinct.has(l));
}

export function scoreForWord(word: string, puzzle: HarfBahcesiPuzzle): number {
  const length = trUpper(word).length;
  const base = length === MIN_WORD_LENGTH ? 1 : length;
  return base + (isPangram(word, puzzle) ? PANGRAM_BONUS : 0);
}

export function getMaxScore(puzzle: HarfBahcesiPuzzle): number {
  return puzzle.validWords.reduce((sum, w) => sum + scoreForWord(w, puzzle), 0);
}

export function getRank(score: number, maxScore: number): { label: string; index: number } {
  const ratio = maxScore === 0 ? 0 : score / maxScore;
  let current = RANKS[0];
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (ratio >= rank.threshold) {
      current = rank;
      index = i;
    }
  });
  return { label: current.label, index };
}

export function getNextRank(rankIndex: number): { label: string; threshold: number } | null {
  return RANKS[rankIndex + 1] ?? null;
}

export type WordSubmitError =
  | "TOO_SHORT"
  | "INVALID_LETTER"
  | "MISSING_CENTER"
  | "NOT_IN_DICTIONARY"
  | "ALREADY_FOUND";

export function validateWord(
  rawWord: string,
  puzzle: HarfBahcesiPuzzle,
  foundWords: string[]
): { ok: true } | { ok: false; error: WordSubmitError } {
  const word = trUpper(rawWord);

  if (word.length < MIN_WORD_LENGTH) return { ok: false, error: "TOO_SHORT" };

  const allowed = new Set(puzzle.letters);
  if (![...word].every((ch) => allowed.has(ch))) return { ok: false, error: "INVALID_LETTER" };

  if (!word.includes(puzzle.centerLetter)) return { ok: false, error: "MISSING_CENTER" };

  if (foundWords.includes(word)) return { ok: false, error: "ALREADY_FOUND" };

  if (!puzzle.validWords.includes(word)) return { ok: false, error: "NOT_IN_DICTIONARY" };

  return { ok: true };
}

export const ERROR_MESSAGES: Record<WordSubmitError, string> = {
  TOO_SHORT: "En az 4 harf olmalı",
  INVALID_LETTER: "Sadece verilen harfleri kullanabilirsin",
  MISSING_CENTER: "Merkez harfi içermeli",
  NOT_IN_DICTIONARY: "Kelime listede yok",
  ALREADY_FOUND: "Zaten buldun",
};

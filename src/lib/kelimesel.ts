import { trUpper } from "./utils";

export type WordLength = 3 | 4 | 5 | 6 | 7 | 8;

export type LetterStatus = "correct" | "present" | "absent";

export const MIN_LENGTH: WordLength = 3;
export const MAX_LENGTH: WordLength = 8;

// NOT: Sözlük (validWords.json) buradan KASTEN çıkarıldı — bu dosya client
// bileşenlerince de kullanılıyor ve 497 KB'lık liste her ziyaretçiye iniyordu.
// Kelime geçerlilik kontrolü artık sadece sunucuda: src/lib/kelimeselDictionary.server.ts

export function getKelimeselGameId(length: WordLength): string {
  return `kelimesel-${length}`;
}

export function getKelimeselOzelGameId(shareCode: string): string {
  return `kelimesel-ozel-${shareCode}`;
}

/** Özel bulmacalar günlük değil (istenildiği zaman/tekrar oynanabilir) — storage.ts'in
 * tarih bazlı depolaması bu sabit "gün" anahtarı altında kullanılıyor, böylece
 * ilerleme gerçek takvim gününe göre kaybolmuyor. */
export const CUSTOM_STORAGE_DATE = "ozel";

export const MAX_CUSTOM_WORDS = 5;
export type CustomMode = "normal" | "hard";

export const CUSTOM_MODE_OPTIONS: { value: CustomMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Zor" },
];

export const CUSTOM_TIME_LIMIT_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Yok" },
  { value: 60, label: "1 dk" },
  { value: 180, label: "3 dk" },
  { value: 300, label: "5 dk" },
  { value: 600, label: "10 dk" },
];

/** Tüm harf uzunlukları için 6 deneme. */
export function getMaxAttempts(): number {
  return 6;
}

export function isTurkishLetter(char: string): boolean {
  return /^[A-ZÇĞİÖŞÜ]$/.test(char);
}

/**
 * İki aşamalı Wordle algoritması: önce doğru pozisyonlar (yeşil) işaretlenir ve
 * cevaptan düşülür, ardından kalan harf frekansına göre yanlış pozisyondakiler
 * (sarı) belirlenir. Bu, çift harfli kelimelerde yanlış sarı fazlalığını önler.
 */
export function evaluateGuess(guess: string, answer: string): LetterStatus[] {
  const guessLetters = trUpper(guess).split("");
  const answerLetters = trUpper(answer).split("");
  const result: LetterStatus[] = new Array(guessLetters.length).fill("absent");
  const remaining: Record<string, number> = {};

  guessLetters.forEach((letter, i) => {
    if (letter === answerLetters[i]) {
      result[i] = "correct";
    } else {
      remaining[answerLetters[i]] = (remaining[answerLetters[i]] ?? 0) + 1;
    }
  });

  guessLetters.forEach((letter, i) => {
    if (result[i] === "correct") return;
    if ((remaining[letter] ?? 0) > 0) {
      result[i] = "present";
      remaining[letter] -= 1;
    }
  });

  return result;
}

const STATUS_RANK: Record<LetterStatus, number> = { absent: 0, present: 1, correct: 2 };

export function mergeKeyboardStatus(
  current: LetterStatus | undefined,
  next: LetterStatus
): LetterStatus {
  if (!current || STATUS_RANK[next] > STATUS_RANK[current]) return next;
  return current;
}

/**
 * Tasarım demosunda kullanılan sahte içerik. Gerçek oyun verisine/localStorage'a
 * bilerek dokunmuyor — demo sayfası sadece görsel kimliği göstermek için var,
 * hiçbir oyun durumunu okumuyor ya da yazmıyor.
 */

export interface DemoGame {
  id: string;
  name: string;
  tagline: string;
  /** O günün tamamlanma rozeti — demoda sabit, gerçek durum değil. */
  done: boolean;
}

export const DEMO_GAMES: DemoGame[] = [
  { id: "kelimesel", name: "Kelimesel", tagline: "Günün kelimesini bul", done: true },
  { id: "sarkisal", name: "Şarkısal", tagline: "Şarkıyı ilk saniyeden tanı", done: false },
  { id: "harfBahcesi", name: "Harf Peteği", tagline: "Yedi harften kelime türet", done: false },
  { id: "dahaAzCok", name: "Daha Az / Daha Çok", tagline: "Hangisi daha fazla?", done: true },
  { id: "karesel", name: "Karesel", tagline: "Tek kareden filmi bil", done: false },
];

export const DEMO_DATE = "6 Ağustos 2026, Perşembe";

/** Kelimesel ekranı için örnek tahminler — durum: doğru / yanlış yerde / yok. */
export type TileState = "correct" | "present" | "absent" | "empty";

export const DEMO_GUESSES: { letter: string; state: TileState }[][] = [
  [
    { letter: "K", state: "absent" },
    { letter: "A", state: "present" },
    { letter: "L", state: "absent" },
    { letter: "E", state: "correct" },
    { letter: "M", state: "absent" },
  ],
  [
    { letter: "S", state: "absent" },
    { letter: "A", state: "correct" },
    { letter: "B", state: "absent" },
    { letter: "E", state: "correct" },
    { letter: "T", state: "present" },
  ],
  [
    { letter: "T", state: "correct" },
    { letter: "A", state: "correct" },
    { letter: "R", state: "absent" },
    { letter: "E", state: "correct" },
    { letter: "K", state: "absent" },
  ],
];

export const DEMO_WORD_LENGTH = 5;
export const DEMO_MAX_ATTEMPTS = 6;

/** Türkçe klavye — X/Q/W yok, Ğ/Ü/Ş/İ/Ö/Ç var. */
export const KEYBOARD_ROWS = [
  ["E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"],
  ["ENTER", "Z", "C", "V", "B", "N", "M", "Ö", "Ç", "SİL"],
];

/** Klavyede renklenen harfler — yukarıdaki tahminlerle tutarlı. */
export const KEY_STATES: Record<string, TileState> = {
  T: "correct",
  A: "correct",
  E: "correct",
  S: "absent",
  K: "absent",
  L: "absent",
  M: "absent",
  B: "absent",
  R: "absent",
};

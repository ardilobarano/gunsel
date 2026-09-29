export interface DahaAzCokCategory {
  id: string;
  label: string;
}

/** "Tümü/Pop/Rap" ile aynı desen — her kategori bağımsız günlük durum. */
export const DAHA_AZ_COK_CATEGORIES: DahaAzCokCategory[] = [
  { id: "nufus", label: "Nüfus" },
  { id: "film", label: "Film" },
  { id: "dizi", label: "Dizi" },
  { id: "spotify", label: "İzlenme" },
  { id: "fiyat", label: "Fiyat" },
  { id: "trivia", label: "Trivia" },
];

/** Günün dizisindeki öğe sayısı — ilk öğe referans olarak verilir, kalan 5'i tahmin edilir. */
export const CHAIN_LENGTH = 6;
export const MAX_STEPS = CHAIN_LENGTH - 1;

/** Kartlardaki sayının 0'dan gerçek değere sayarak yükseldiği süre (DahaAzCokGame.tsx'teki
 * useCountUp). Doğru/yanlış renkleri (yeşil/kırmızı kenarlık) bilerek bu süre bitene kadar
 * ERTELENİYOR — useDahaAzCok.ts'teki submitGuess akışına bkz: sayı sayarken renk gelmesi
 * "daha sayı bitmeden sonucu söylemiş olmak" gibi hissettiriyordu, artık önce sayı duruyor,
 * SONRA renk geliyor. */
export const COUNT_UP_MS = 3000;
/** Renkler göründükten sonra (sayı durduktan sonra) yeni çifte geçmeden önce ne kadar
 * beklensin — kullanıcının sonucu (yeşil/kırmızı) net görmesi için. */
export const OUTCOME_HOLD_MS = 2000;

/**
 * Birimin NEYİ ölçtüğü.
 *
 * Şart oldu çünkü kartlarda yalnızca ad ve birim yazıyordu, ölçülen büyüklük
 * hiçbir yerde yazmıyordu — Trivia'da "Fil · ? kg" ile "Fil · ? yıl" arasındaki
 * fark yalnızca birimden anlaşılıyor, "Jüpiter · ? milyon km" ise neyin uzaklığı
 * olduğunu hiç söylemiyordu (kullanıcı bildirdi: "neyi karşılaştırıyoruz
 * anlamıyoruz"). Artık tahtanın üstünde bu ad yazıyor.
 *
 * Anahtar BİRİM, kategori değil: Trivia tek kategori ama sekiz ayrı büyüklük
 * ölçüyor ve günün zinciri hep tek birimden kuruluyor (bkz. dahaAzCok.server.ts).
 */
const OLCULER: Record<string, { ad: string; soru: string }> = {
  kişi: { ad: "Nüfus", soru: "Hangisi daha kalabalık?" },
  puan: { ad: "IMDb puanı", soru: "Hangisinin puanı daha yüksek?" },
  izlenme: { ad: "YouTube izlenmesi", soru: "Hangisi daha çok izlenmiş?" },
  "milyon $": { ad: "Satın alma bedeli", soru: "Hangisi daha pahalıya satılmış?" },
  metre: { ad: "Dağ yüksekliği", soru: "Hangisi daha yüksek?" },
  km: { ad: "Nehir uzunluğu", soru: "Hangisi daha uzun?" },
  "km²": { ad: "Ülke yüzölçümü", soru: "Hangisi daha büyük?" },
  "km/sa": { ad: "En yüksek hız", soru: "Hangisi daha hızlı?" },
  "milyon km": { ad: "Güneş'e uzaklık", soru: "Hangisi Güneş'ten daha uzak?" },
  yıl: { ad: "Ortalama ömür", soru: "Hangisi daha uzun yaşar?" },
  kg: { ad: "Ağırlık", soru: "Hangisi daha ağır?" },
  "°C": { ad: "Erime noktası", soru: "Hangisi daha yüksek sıcaklıkta erir?" },
};

/** Bilinmeyen birimde birimin kendisi ve genel soru — boş başlık göstermektense. */
export function olcu(unit: string): { ad: string; soru: string } {
  return OLCULER[unit] ?? { ad: unit, soru: "Hangisi daha çok?" };
}

export type GuessDirection = "higher" | "lower";

export function getDahaAzCokGameId(categoryId: string): string {
  return `dahaAzCok-${categoryId}`;
}

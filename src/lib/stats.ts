import { getHistory } from "@/lib/storage";
import type { GameStat } from "@/lib/types";
import { getTodayKey } from "@/lib/utils";

/**
 * İstatistikler localStorage'daki geçmişten HESAPLANIYOR — oyunlar zaten her günün
 * sonucunu oraya yazdığı için ayrıca veri toplamaya gerek yok.
 *
 * Kısıt: localStorage cihaza özel. Telefondaki geçmiş bilgisayarda görünmez, tarayıcı
 * verisi temizlenirse sıfırlanır. Cihazlar arası senkron istenirse sunucuya yazmak
 * gerekir (ayrı iş).
 */

export interface BaseStats {
  /** Tamamlanan (WON veya LOST) gün sayısı — yarım kalanlar sayılmıyor. */
  played: number;
  won: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
}

function isFinished(stat: GameStat): boolean {
  return stat.status === "WON" || stat.status === "LOST";
}

/** Ardışık gün kontrolü için tarih anahtarını gün sayısına çevirir. */
function toDayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Seri hesabı: sadece KAZANILAN günler seriyi sürdürür ve günler ARDIŞIK olmalı.
 * storage.ts'teki getStreak yalnızca bugünden geriye bakıyor; burada en uzun seri de
 * gerektiği için geçmişin tamamı taranıyor.
 *
 * ÖNEMLİ: Önce GÜNE göre sadeleştiriliyor. Kelimesel'in 6 harf uzunluğu, Şarkısal'ın
 * 3 kategorisi gibi çok modlu oyunlarda aynı güne birden fazla kayıt düşüyor; ham
 * listede iki kayıt arasındaki fark 1 değil 0 olduğu için seri yanlışlıkla sıfırlanıyordu.
 * Bir gün, o gün en az bir modda kazanıldıysa "kazanılmış" sayılır.
 */
function computeStreaks(history: { dateKey: string; stat: GameStat }[]): {
  currentStreak: number;
  maxStreak: number;
} {
  const wonByDay = new Map<number, boolean>();
  for (const { dateKey, stat } of history) {
    if (!isFinished(stat)) continue;
    const day = toDayNumber(dateKey);
    wonByDay.set(day, (wonByDay.get(day) ?? false) || stat.status === "WON");
  }

  const days = [...wonByDay.keys()].sort((a, b) => a - b);
  let maxStreak = 0;
  let run = 0;
  let previousDay: number | null = null;

  for (const day of days) {
    if (!wonByDay.get(day)) {
      run = 0;
      previousDay = day;
      continue;
    }
    run = previousDay !== null && day - previousDay === 1 ? run + 1 : 1;
    previousDay = day;
    if (run > maxStreak) maxStreak = run;
  }

  // Güncel seri ancak son kazanç bugün ya da dün ise devam ediyor sayılır —
  // dünkü kazançtan sonra bugün henüz oynanmamış olabilir, seri kırılmış olmaz.
  const today = toDayNumber(getTodayKey());
  const currentStreak = previousDay !== null && today - previousDay <= 1 ? run : 0;

  return { currentStreak, maxStreak };
}

function baseStats(history: { dateKey: string; stat: GameStat }[]): BaseStats {
  const finished = history.filter(({ stat }) => isFinished(stat));
  const won = finished.filter(({ stat }) => stat.status === "WON").length;
  const { currentStreak, maxStreak } = computeStreaks(history);

  return {
    played: finished.length,
    won,
    winRate: finished.length === 0 ? 0 : Math.round((won / finished.length) * 100),
    currentStreak,
    maxStreak,
  };
}

/** Birden fazla mod (ör. Kelimesel'in 3-8 harfi) tek bir oyunun istatistiği olarak birleştirilir. */
function mergeHistories(gameIds: string[]): { dateKey: string; stat: GameStat }[] {
  return gameIds
    .flatMap((id) => getHistory(id))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export interface DistributionStats extends BaseStats {
  /** index = kaçıncı denemede kazanıldığı - 1; değer = o denemede kazanılan gün sayısı. */
  distribution: number[];
}

/**
 * Kazanılan oyunlarda "kaçıncı denemede bildi" dağılımı. attemptsOf, oyunun kendi
 * kaydından deneme sayısını çıkarıyor (Kelimesel'de tahmin sayısı, Şarkısal'da
 * dinlenen aşama, Karesel'de açılan kare).
 */
function distributionStats(
  gameIds: string[],
  maxAttempts: number,
  attemptsOf: (stat: GameStat) => number | null
): DistributionStats {
  const history = mergeHistories(gameIds);
  const distribution = new Array(maxAttempts).fill(0);

  for (const { stat } of history) {
    if (stat.status !== "WON") continue;
    const attempts = attemptsOf(stat);
    if (attempts !== null && attempts >= 1 && attempts <= maxAttempts) {
      distribution[attempts - 1] += 1;
    }
  }

  return { ...baseStats(history), distribution };
}

export function getKelimeselStats(gameIds: string[], maxAttempts: number): DistributionStats {
  return distributionStats(gameIds, maxAttempts, (stat) => stat.guesses?.length ?? stat.attempts ?? null);
}

export function getSarkisalStats(gameIds: string[], maxAttempts: number): DistributionStats {
  return distributionStats(gameIds, maxAttempts, (stat) => stat.songGuesses?.length ?? stat.attempts ?? null);
}

/** Şarkısal/Haritasal gibi ÇOK kimlikli: Film ve Dizi sekmeleri ayrı gameId'ye
 *  yazıyor, istatistik kartı ikisini topluyor. */
export function getKareselStats(gameIds: string[], maxAttempts: number): DistributionStats {
  return distributionStats(gameIds, maxAttempts, (stat) => stat.movieGuesses?.length ?? stat.attempts ?? null);
}

/**
 * Renksel: dağılım "kaç denemede" değil ALDIĞIN PUAN (1-10). Oyunda deneme
 * kavramı yok — tek hak var, ölçülen şey isabet. `guessCount` sütununa da
 * yuvarlanmış puan yazılıyor (bkz. api/renksel/guess).
 */
export function getRenkselStats(gameId: string, enYuksekPuan: number): DistributionStats {
  return distributionStats([gameId], enYuksekPuan, (stat) => {
    const p = stat.renkselSonuclar?.[0]?.puan;
    return p === undefined ? (stat.attempts ?? null) : Math.max(1, Math.round(p));
  });
}

/** Haritasal: kaç tahminde bulundu — Karesel/Kelimesel ile aynı dağılım biçimi.
 *  Şarkısal gibi ÇOK kimlikli: Dünya ve İller sekmeleri ayrı gameId'ye yazıyor,
 *  istatistik kartı ikisini topluyor. */
export function getHaritasalStats(gameIds: string[], maxAttempts: number): DistributionStats {
  return distributionStats(gameIds, maxAttempts, (stat) => stat.haritasalGuesses?.length ?? stat.attempts ?? null);
}

/**
 * Bağlamsal: dağılım HATA sayısına göre (0-3). Diğer oyunlarda "kaç denemede
 * bildin" ölçülüyor; burada deneme sayısı anlamlı değil, kaç hatayla bitirdiğin
 * anlamlı. distributionStats 1'den başlayan bir dizin beklediği için hata+1.
 */
export function getBaglamsalStats(gameId: string): DistributionStats {
  return distributionStats([gameId], 4, (stat) => (stat.baglamsalMistakes ?? 0) + 1);
}

export interface HarfBahcesiStats extends BaseStats {
  totalWords: number;
  bestWordCount: number;
}

export function getHarfBahcesiStats(gameId: string): HarfBahcesiStats {
  const history = getHistory(gameId);
  // Harf Peteği bulunan kelimeleri guesses alanında tutuyor (bkz. useHarfBahcesi).
  const counts = history.map(({ stat }) => stat.guesses?.length ?? 0);
  return {
    ...baseStats(history),
    totalWords: counts.reduce((sum, n) => sum + n, 0),
    bestWordCount: counts.length ? Math.max(...counts) : 0,
  };
}

export interface DahaAzCokStats extends BaseStats {
  /** Tamamlanan turlarda ortalama doğru sayısı (0-5). */
  averageCorrect: number;
  bestCorrect: number;
  totalRounds: number;
}

export function getDahaAzCokStats(gameIds: string[]): DahaAzCokStats {
  const history = mergeHistories(gameIds);
  const finished = history.filter(({ stat }) => isFinished(stat));
  const corrects = finished.map(
    ({ stat }) => stat.dahaAzCokRoundResults?.filter(Boolean).length ?? 0
  );

  return {
    ...baseStats(history),
    averageCorrect: corrects.length
      ? Math.round((corrects.reduce((sum, n) => sum + n, 0) / corrects.length) * 10) / 10
      : 0,
    bestCorrect: corrects.length ? Math.max(...corrects) : 0,
    totalRounds: finished.reduce((sum, { stat }) => sum + (stat.dahaAzCokRoundResults?.length ?? 0), 0),
  };
}

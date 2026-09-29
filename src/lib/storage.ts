import type { BulmacaStats, DayStats, GameStat } from "./types";
import { getTodayKey } from "./utils";

const STORAGE_KEY = "bulmaca_stats";

/**
 * Arşivde (geçmiş bir günü sonradan) oynanan bulmacalar AYRI bir alanda tutulur.
 *
 * Neden: bu dosyadaki her şey tarihe göre anahtarlanıyor ve getStreak bugünden
 * geriye doğru yürüyor. Arşiv sonuçları aynı yere yazsaydı, biri geçmiş günleri
 * sırayla oynayıp kendine geriye dönük 30 günlük seri üretebilirdi ve günlük
 * ritüelin anlamı kalmazdı. İstatistik sayfası da yalnızca günlük alanı okur.
 */
const ARCHIVE_KEY = "bulmaca_arsiv";

function readAll(archive = false): BulmacaStats {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(archive ? ARCHIVE_KEY : STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BulmacaStats) : {};
  } catch {
    return {};
  }
}

function writeAll(stats: BulmacaStats, archive = false): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(archive ? ARCHIVE_KEY : STORAGE_KEY, JSON.stringify(stats));
}

export function getDayStats(dateKey: string = getTodayKey(), archive = false): DayStats {
  return readAll(archive)[dateKey] ?? {};
}

export function getGameStat(
  gameId: string,
  dateKey: string = getTodayKey(),
  archive = false
): GameStat | undefined {
  return getDayStats(dateKey, archive)[gameId];
}

export function setGameStat(
  gameId: string,
  stat: GameStat,
  dateKey: string = getTodayKey(),
  archive = false
): void {
  const all = readAll(archive);
  const day = all[dateKey] ?? {};
  day[gameId] = stat;
  all[dateKey] = day;
  writeAll(all, archive);
}

export interface SunucuSonucu {
  gameId: string;
  dateKey: string;
  status: string;
  guessCount: number | null;
  /** Tahmin/kare geçmişi + açığa çıkan cevap — bkz. mergeServerResults. */
  payload?: unknown;
}

/** status/attempts/attemptsToken dışındaki her şey — "sonucu göster" ekranının
 *  ihtiyaç duyduğu her alan burada kalır (guesses, evaluations, revealedWord,
 *  songGuesses, revealedAnswer, dahaAzCok*, vb.). Kontrol alanları çıkarılıyor:
 *  status/attempts zaten ayrı sütun, attemptsToken senkronlanmaya değecek kadar
 *  önemli değil (sadece o cihazdaki yarım kalmış oyuna devam için var). */
const KONTROL_ALANLARI = new Set(["status", "attempts", "attemptsToken"]);

function extractPayload(stat: GameStat): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stat)) {
    if (!KONTROL_ALANLARI.has(key)) rest[key] = value;
  }
  return rest;
}

/**
 * Sunucudaki (hesaba bağlı) geçmişi cihazdaki kayda birleştirir.
 *
 * Neden ayrı bir okuma yolu değil de birleştirme: istatistik hesabı, hub'daki
 * tamamlanma rozetleri ve seri hesabı zaten bu depoyu okuyor. Sunucu verisini
 * buraya yazınca hepsi tek satır değişiklikle senkron oluyor.
 *
 * Kurallar:
 * - Cihazda O GÜN + O OYUN için kayıt yoksa sunucudakini yaz (başka cihazda
 *   oynanmış bir gün böyle geliyor).
 * - Cihazda kayıt varsa DOKUNMA: yereldeki daha zengin (tahminler, harf renkleri,
 *   yarım kalan oyunun durumu). Tek istisna aşağıda.
 * - Yerel "PLAYING" ama sunucu bitmiş diyorsa sunucu kazanır — oyun başka bir
 *   cihazda bitirilmiş demektir.
 *
 * @returns birleştirme sonucu değişiklik olduysa true
 */
export function mergeServerResults(results: SunucuSonucu[]): boolean {
  if (typeof window === "undefined" || results.length === 0) return false;

  const all = readAll();
  let degisti = false;

  for (const r of results) {
    if (r.status !== "WON" && r.status !== "LOST") continue;
    const day = all[r.dateKey] ?? {};
    const mevcut = day[r.gameId];
    if (mevcut && mevcut.status !== "PLAYING") continue;

    day[r.gameId] = {
      ...mevcut,
      status: r.status,
      attempts: r.guessCount ?? mevcut?.attempts ?? 0,
      ...(r.payload && typeof r.payload === "object" ? (r.payload as Partial<GameStat>) : {}),
    };
    all[r.dateKey] = day;
    degisti = true;
  }

  if (degisti) writeAll(all);
  return degisti;
}

/** Sunucuya taşınacak yerel geçmiş — sadece BİTMİŞ günler. */
export function collectLocalHistory(): SunucuSonucu[] {
  const all = readAll();
  const out: SunucuSonucu[] = [];
  for (const [dateKey, day] of Object.entries(all)) {
    for (const [gameId, stat] of Object.entries(day)) {
      if (stat.status !== "WON" && stat.status !== "LOST") continue;
      out.push({ gameId, dateKey, status: stat.status, guessCount: stat.attempts ?? null, payload: extractPayload(stat) });
    }
  }
  return out;
}

/**
 * Bir oyun bitince (WON/LOST) tahmin/kare geçmişini + açığa çıkan cevabı sunucuya
 * ekler — StatsSync'in oturum başına bir kez çalışan içe aktarımını beklemeden,
 * ANINDA. Diğer cihazlar bir sonraki ziyaretlerinde bunu mergeServerResults ile
 * çeker. Best-effort: giriş yoksa sunucu 401 döner, burada sessizce yutuluyor —
 * senkron hiçbir zaman oyunu bozmamalı (bkz. dailyResult.server.ts'teki aynı ilke).
 */
export function syncFinishedGamePayload(gameId: string, dateKey: string, stat: GameStat): void {
  const payload = extractPayload(stat);
  if (Object.keys(payload).length === 0) return;
  fetch("/api/istatistikler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: { gameId, dateKey, data: payload } }),
  }).catch(() => {
    /* ağ hatası — bir sonraki cihaz ziyaretinde eksik detay olarak kalır, oyunu etkilemez */
  });
}

/** Arşiv listesi için: bir günün bir oyunu ya günlük oynanmış ya da arşivden — ikisi de "tamamlandı". */
export function isDoneOnDate(gameId: string, dateKey: string): boolean {
  const bitti = (s?: GameStat) => s?.status === "WON" || s?.status === "LOST";
  return bitti(getGameStat(gameId, dateKey)) || bitti(getGameStat(gameId, dateKey, true));
}

export function isCompletedToday(gameId: string): boolean {
  const stat = getGameStat(gameId);
  return stat?.status === "WON" || stat?.status === "LOST";
}

/** Verilen kimliklerin (örn. tüm harf uzunluğu modları) HEPSİ bugün tamamlandıysa true döner. */
export function areAllCompletedToday(gameIds: string[], dateKey: string = getTodayKey()): boolean {
  const day = getDayStats(dateKey);
  return gameIds.every((id) => day[id]?.status === "WON" || day[id]?.status === "LOST");
}

/** Tüm günlerin ham kaydı — istatistik sayfası gibi geçmişi tarayan yerler için. */
export function getAllStats(): BulmacaStats {
  return readAll();
}

/** Bir oyun kimliği için tüm günlerin kayıtları, tarihiyle birlikte (eskiden yeniye). */
export function getHistory(gameId: string): { dateKey: string; stat: GameStat }[] {
  const all = readAll();
  return Object.keys(all)
    .sort()
    .flatMap((dateKey) => {
      const stat = all[dateKey]?.[gameId];
      return stat ? [{ dateKey, stat }] : [];
    });
}

/** Bugünden geriye doğru art arda tamamlanan (WON) gün sayısı. */
export function getStreak(gameId: string): number {
  const all = readAll();
  let streak = 0;
  const cursor = new Date();

  for (;;) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
      cursor.getDate()
    ).padStart(2, "0")}`;
    const stat = all[key]?.[gameId];
    if (stat?.status !== "WON") break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

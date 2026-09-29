import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getKelimeselGameId, getMaxAttempts, type WordLength } from "@/lib/kelimesel";
import { getDailyIndex } from "@/lib/dailySelection.server";
import { prisma } from "@/lib/prisma";
import targetWordsData from "@/data/targetWords.json";
import validWordsData from "@/data/validWords.json";
import overridesData from "@/data/wordOverrides.json";

if (!process.env.GUESS_TOKEN_SECRET) throw new Error("GUESS_TOKEN_SECRET tanımlı değil.");
const TOKEN_SECRET: string = process.env.GUESS_TOKEN_SECRET;

const targetWords = targetWordsData as Record<string, string[]>;
const validWords = validWordsData as Record<string, string[]>;
/** Belirli tarih+uzunluk için elle zorlanan kelime — src/data/wordOverrides.json'a
 * `{ "2026-10-29": { "5": "ZAFER" } }` şeklinde ekleyerek o günü otomatik seçimin
 * yerine geçirebilirsin. Belirtilmeyen her gün/uzunluk otomatik seçilmeye devam eder. */
const overrides = overridesData as Record<string, Record<string, string>>;

/** Tarih + harf uzunluğuna göre günün kelimesi — önce elle override var mı bakılır,
 * yoksa deterministik otomatik seçime (sunucu tarafı, gerçek cevap) düşülür.
 *
 * Seçim indeksi sunucu sırrıyla (getDailyIndex) hesaplanıyor. Önceki `hashString(...) %
 * n` deseni cevabı client'tan hesaplanabilir kılıyordu: `validWords.json` sözlük
 * kontrolü için tarayıcıya gidiyor ve `targetWords.json` ile birebir aynı sırada —
 * yani havuz da, hash de saldırgana açıktı. Ayrıntı için bkz. dailySelection.server.ts. */
export function getDailyWord(dateKey: string, length: WordLength): string {
  const override = overrides[dateKey]?.[String(length)];
  if (override) {
    const validPool = validWords[String(length)] ?? [];
    if (validPool.includes(override)) return override;
    console.warn(
      `[wordOverrides] ${dateKey}/${length} için "${override}" geçerli kelime listesinde yok, otomatik seçime düşülüyor.`
    );
  }

  const pool = targetWords[String(length)] ?? [];
  if (pool.length === 0) return "";
  return pool[getDailyIndex(`kelimesel-${dateKey}-${length}`, pool.length)];
}

/** Host'un yerel TZ ayarından bağımsız, sabit UTC+3 (İstanbul, DST yok) "bugün" anahtarı. */
export function getServerTodayKey(): string {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Oyun bitince (WON/LOST) /api/kelimesel/guess'in bizzat kendisi çağırıyor — bu route
 * cevabı tek otorite olarak belirlediği için tahmin dağılımı verisi burada sahtelenemiyor
 * (ayrı bir "sonucu bildir" endpoint'i olsaydı client'tan uydurulabilirdi). */
export async function recordDailyResult(
  dateKey: string,
  length: WordLength,
  status: "WON" | "LOST",
  guessCount: number | null
): Promise<void> {
  await prisma.dailyResult.create({
    data: { gameId: getKelimeselGameId(length), dateKey, status, guessCount },
  });
}

export interface DailyResultStats {
  wins: number[];
  losses: number;
  average: number | null;
  total: number;
}

/** Belirli tarih+uzunluk için TÜM oyuncuların tahmin dağılımı — lessgames'teki "top %X
 * of players today" karşılığı, günün bulmacasına özel (tüm zamanlar toplamı değil). */
export async function getDailyResultStats(dateKey: string, length: WordLength): Promise<DailyResultStats> {
  /* `userId: null` ŞART. Her tamamlanan oyun İKİ satır yazıyor (bkz.
     recordDailyResult): userId'si boş anonim toplam satırı ve giriş yapmışsa
     kişisel satır. Filtre olmadan giriş yapmış oyuncu İKİ KEZ sayılıyordu —
     tek kişinin çözdüğü bir günde grafik 2 oyuncu gösteriyordu (kullanıcı
     bildirdi). Dağılımın sayacağı satır, tasarım gereği anonim olan. */
  const rows = await prisma.dailyResult.findMany({
    where: { gameId: getKelimeselGameId(length), dateKey, userId: null },
    select: { status: true, guessCount: true },
  });

  const maxAttempts = getMaxAttempts();
  const wins = new Array(maxAttempts).fill(0);
  let losses = 0;
  let totalGuesses = 0;
  let winCount = 0;

  for (const row of rows) {
    if (row.status === "WON" && row.guessCount && row.guessCount >= 1 && row.guessCount <= maxAttempts) {
      wins[row.guessCount - 1] += 1;
      totalGuesses += row.guessCount;
      winCount += 1;
    } else if (row.status === "LOST") {
      losses += 1;
    }
  }

  return { wins, losses, average: winCount > 0 ? totalGuesses / winCount : null, total: rows.length };
}

interface AttemptsPayload {
  date: string;
  length: WordLength;
  attempts: number;
}

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

export function signAttemptsToken(payload: AttemptsPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Token'ı doğrular ve beklenen date/length ile eşleşiyorsa attempts sayısını döner. Geçersizse null. */
export function verifyAttemptsToken(
  token: string,
  expected: { date: string; length: WordLength }
): number | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: AttemptsPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.date !== expected.date || payload.length !== expected.length) return null;

  const maxAttempts = getMaxAttempts();
  if (typeof payload.attempts !== "number" || payload.attempts < 0 || payload.attempts >= maxAttempts) {
    return null;
  }
  return payload.attempts;
}

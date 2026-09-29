import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { recordDailyResult } from "@/lib/dailyResult.server";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { evaluateGuess, getMaxAttempts, MAX_LENGTH, MIN_LENGTH, type WordLength, getKelimeselGameId } from "@/lib/kelimesel";
import { isValidWord } from "@/lib/kelimeselDictionary.server";
import {
  getDailyWord,
  getServerTodayKey,
  signAttemptsToken,
  verifyAttemptsToken,
} from "@/lib/kelimesel.server";
import { trUpper } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Oyun uçları hız sınırlı. Sebep somut: sınırsızken 9 istekle DailyResult'a bir satır
   yazdırılabiliyordu (tam bir oyun oynayarak) — bir script bunu binlerce kez tekrarlayıp
   hem "oyuncuların dağılımı" grafiğini anlamsızlaştırır hem de veritabanını şişirirdi.
   Sınır gerçek oyun için fazlasıyla geniş: normal bir oyuncu tüm oyunları bitirse
   ~50 istek atar. Sayaç süreç belleğinde olduğu için Vercel'de örnek başına uygulanır
   (bkz. rateLimit.ts) — kesin bir kalkan değil, kötüye kullanımı pahalılaştıran bir eşik. */
const RL_LIMIT = 120;
const RL_WINDOW_MS = 60_000;


const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface GuessBody {
  date?: string;
  length?: number;
  guess?: string;
  attemptsToken?: string;
}

export async function POST(request: Request) {
  const limited = await rateLimit(`kelimesel-guess:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  let body: GuessBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const { date, length: lengthParam, guess: rawGuess, attemptsToken } = body;

  if (!date || !DATE_RE.test(date) || date > getServerTodayKey()) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }

  // Bugün dışındaki günler ARŞİVDİR: giriş şart ve pencere sınırlı. Kontrol
  // sunucuda olmak zorunda — geçmiş günlerin cevapları bu uçtan korumasız
  // alınabiliyordu, sadece arayüzü gizlemek sahte bir kilit olurdu.
  if (!isWithinArchiveWindow(date, getServerTodayKey())) {
    return NextResponse.json({ error: "Bu tarih arşiv aralığının dışında." }, { status: 400 });
  }
  const erisim = await guardArchiveAccess(date, getServerTodayKey());
  if (!erisim.ok) {
    return NextResponse.json({ error: erisim.error }, { status: erisim.status });
  }
  if (
    typeof lengthParam !== "number" ||
    !Number.isInteger(lengthParam) ||
    lengthParam < MIN_LENGTH ||
    lengthParam > MAX_LENGTH
  ) {
    return NextResponse.json({ error: "Geçersiz uzunluk." }, { status: 400 });
  }
  const length = lengthParam as WordLength;

  if (!rawGuess || typeof rawGuess !== "string" || rawGuess.length !== length) {
    return NextResponse.json({ error: "Geçersiz tahmin." }, { status: 400 });
  }
  if (!attemptsToken) {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 400 });
  }

  const attempts = verifyAttemptsToken(attemptsToken, { date, length });
  if (attempts === null) {
    return NextResponse.json({ error: "Geçersiz veya süresi geçmiş token." }, { status: 400 });
  }

  const answer = getDailyWord(date, length);
  if (!answer) {
    return NextResponse.json({ error: "Bu uzunluk için kelime bulunamadı." }, { status: 404 });
  }

  const guess = trUpper(rawGuess);

  if (!isValidWord(guess, length)) {
    return NextResponse.json({ valid: false });
  }

  const evaluation = evaluateGuess(guess, answer);
  const won = guess === answer;
  const nextAttempts = attempts + 1;
  const reveal = won || nextAttempts >= getMaxAttempts();

  if (reveal) {
    await recordDailyResult({
      gameId: getKelimeselGameId(length),
      dateKey: date,
      status: won ? "WON" : "LOST",
      guessCount: won ? nextAttempts : null,
    });
    return NextResponse.json({
      valid: true,
      evaluation,
      status: won ? "WON" : "LOST",
      revealedWord: answer,
    });
  }

  return NextResponse.json({
    valid: true,
    evaluation,
    status: "PLAYING",
    attemptsToken: signAttemptsToken({ date, length, attempts: nextAttempts }),
  });
}

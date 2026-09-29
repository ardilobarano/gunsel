import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { recordDailyResult } from "@/lib/dailyResult.server";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { MAX_ATTEMPTS, gecerliKategori, getKareselGameId } from "@/lib/karesel";
import {
  getDailyMovie,
  getRevealedFrames,
  getServerTodayKey,
  signAttemptsToken,
  verifyAttemptsToken,
} from "@/lib/karesel.server";

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
  /** Pas geçildiyse null. */
  tmdbId?: number | null;
  kategori?: string;
  attemptsToken?: string;
}

export async function POST(request: Request) {
  const limited = await rateLimit(`karesel-guess:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
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

  const { date, tmdbId, attemptsToken } = body;
  const kategoriId = body.kategori ?? "";

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
  if (!attemptsToken) {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 400 });
  }

  if (!gecerliKategori(kategoriId)) {
    return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
  }

  const attempts = verifyAttemptsToken(attemptsToken, date, kategoriId);
  if (attempts === null) {
    return NextResponse.json({ error: "Geçersiz veya süresi geçmiş token." }, { status: 400 });
  }

  const movie = getDailyMovie(date, kategoriId);
  if (!movie) {
    return NextResponse.json({ error: "Bugün için film bulunamadı." }, { status: 404 });
  }

  const correct = typeof tmdbId === "number" && tmdbId === movie.tmdbId;
  const nextAttempts = attempts + 1;
  const reveal = correct || nextAttempts >= MAX_ATTEMPTS;

  if (reveal) {
    await recordDailyResult({
      gameId: getKareselGameId(kategoriId),
      dateKey: date,
      status: correct ? "WON" : "LOST",
      guessCount: correct ? nextAttempts : null,
    });
    // Oyun bitti — cevap ve TÜM kareler artık açılabilir.
    return NextResponse.json({
      correct,
      answer: { title: movie.title, originalTitle: movie.originalTitle, year: movie.year },
      frames: movie.frames,
    });
  }

  return NextResponse.json({
    correct,
    frames: getRevealedFrames(movie, nextAttempts),
    attemptsToken: signAttemptsToken({ date, kategoriId, attempts: nextAttempts }),
  });
}

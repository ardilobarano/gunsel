import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { recordDailyResult } from "@/lib/dailyResult.server";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { MAX_ATTEMPTS, SONG_CATEGORIES, getSarkisalGameId } from "@/lib/sarkisal";
import { getDailyChallenge, getServerTodayKey, signAttemptsToken, verifyAttemptsToken } from "@/lib/sarkisal.server";
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
  categoryId?: string;
  spotifyTrackId?: string | null;
  /** Kullanıcının seçtiği şarkının sanatçı adı — zaten arama sonucunda kendisine
   * gösterildiği için cevabı ifşa etmiyor, sadece "sanatçı doğru mu" ipucu için
   * sunucudaki gerçek cevapla karşılaştırılıyor. */
  artist?: string | null;
  attemptsToken?: string;
}

function normalizeArtist(value: string): string {
  return trUpper(value).replace(/\s+/g, " ").trim();
}

/** Tam eşitlik ya da biri diğerini kapsıyorsa (ör. "Ezhel" ile "Ezhel, Contra")
 * sanatçı eşleşmesi say. */
function artistsMatch(a: string, b: string): boolean {
  const na = normalizeArtist(a);
  const nb = normalizeArtist(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function POST(request: Request) {
  const limited = await rateLimit(`sarkisal-guess:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
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

  const { date, categoryId, spotifyTrackId, artist, attemptsToken } = body;

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
  if (!categoryId || !SONG_CATEGORIES.some((c) => c.id === categoryId)) {
    return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
  }
  if (!attemptsToken) {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 400 });
  }

  const attempts = verifyAttemptsToken(attemptsToken, { date, categoryId });
  if (attempts === null) {
    return NextResponse.json({ error: "Geçersiz veya süresi geçmiş token." }, { status: 400 });
  }

  const challenge = getDailyChallenge(date, categoryId);
  if (!challenge) {
    return NextResponse.json({ error: "Bu kategori için şarkı bulunamadı." }, { status: 404 });
  }

  const correct = !!spotifyTrackId && spotifyTrackId === challenge.spotifyTrackId;
  const artistMatch = !correct && !!artist && artistsMatch(artist, challenge.artist);
  const nextAttempts = attempts + 1;
  const reveal = correct || nextAttempts >= MAX_ATTEMPTS;

  if (reveal) {
    await recordDailyResult({
      gameId: getSarkisalGameId(categoryId),
      dateKey: date,
      status: correct ? "WON" : "LOST",
      guessCount: correct ? nextAttempts : null,
    });
    return NextResponse.json({
      correct,
      artistMatch,
      answer: { title: challenge.title, artist: challenge.artist },
    });
  }

  return NextResponse.json({
    correct,
    artistMatch,
    attemptsToken: signAttemptsToken({ date, categoryId, attempts: nextAttempts }),
  });
}

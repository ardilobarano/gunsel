import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { recordDailyResult } from "@/lib/dailyResult.server";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { DAHA_AZ_COK_CATEGORIES, MAX_STEPS, getDahaAzCokGameId } from "@/lib/dahaAzCok";
import {
  getDailySequence,
  getServerTodayKey,
  signAttemptsToken,
  verifyAttemptsToken,
} from "@/lib/dahaAzCok.server";

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
  category?: string;
  guess?: string;
  attemptsToken?: string;
}

export async function POST(request: Request) {
  const limited = await rateLimit(`dahaazcok-guess:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
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

  const { date, category, guess, attemptsToken } = body;

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
  if (!category || !DAHA_AZ_COK_CATEGORIES.some((c) => c.id === category)) {
    return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
  }
  if (guess !== "higher" && guess !== "lower") {
    return NextResponse.json({ error: "Geçersiz tahmin." }, { status: 400 });
  }
  if (!attemptsToken) {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 400 });
  }

  const payload = verifyAttemptsToken(attemptsToken, { date, category });
  if (payload === null) {
    return NextResponse.json({ error: "Geçersiz veya süresi geçmiş token." }, { status: 400 });
  }
  const { stepIndex, correctCount } = payload;

  const sequence = await getDailySequence(date, category);
  if (!sequence) {
    return NextResponse.json({ error: "Bu kategori için veri bulunamadı." }, { status: 404 });
  }

  const current = sequence[stepIndex];
  const next = sequence[stepIndex + 1];

  // Eşitlik durumunda tahmin yönüne bakılmaksızın doğru sayılır (yaygın Higher-Lower
  // konvansiyonu) — aksi halde bazı günlerde hiçbir cevap doğru olmayan adil olmayan
  // bir durum ortaya çıkardı.
  const correct =
    next.value === current.value || (guess === "higher" ? next.value > current.value : next.value < current.value);

  // Yanlış tahmin artık oyunu bitirmiyor — sadece skor tutuluyor, zincir her durumda
  // 5 turun sonuna kadar devam ediyor.
  const nextCorrectCount = correctCount + (correct ? 1 : 0);
  const nextStepIndex = stepIndex + 1;

  if (nextStepIndex >= MAX_STEPS) {
    // Bu oyunda kaybetmek yok; skor tutuluyor. guessCount = doğru sayısı.
    await recordDailyResult({
      gameId: getDahaAzCokGameId(category),
      dateKey: date,
      status: "WON",
      guessCount: nextCorrectCount,
    });
    return NextResponse.json({
      correct,
      status: "WON",
      stepIndex: nextStepIndex,
      correctCount: nextCorrectCount,
      revealedItem: next,
    });
  }

  const upcoming = sequence[nextStepIndex + 1];
  return NextResponse.json({
    correct,
    status: "PLAYING",
    stepIndex: nextStepIndex,
    correctCount: nextCorrectCount,
    revealedItem: next,
    nextItem: { id: upcoming.id, label: upcoming.label, unit: upcoming.unit, imageUrl: upcoming.imageUrl },
    attemptsToken: signAttemptsToken({ date, category, stepIndex: nextStepIndex, correctCount: nextCorrectCount }),
  });
}

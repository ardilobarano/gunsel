import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { SONG_CATEGORIES } from "@/lib/sarkisal";
import { getDailyChallenge, getServerTodayKey, signAttemptsToken } from "@/lib/sarkisal.server";

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

export async function GET(request: Request) {
  const limited = await rateLimit(`sarkisal-challenge:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";

  if (!DATE_RE.test(date) || date > getServerTodayKey()) {
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
  if (!SONG_CATEGORIES.some((c) => c.id === categoryId)) {
    return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
  }

  const challenge = getDailyChallenge(date, categoryId);
  if (!challenge) {
    return NextResponse.json({ error: "Bu kategori için şarkı bulunamadı." }, { status: 404 });
  }

  /* İstemcinin bildirdiği deneme sayısı ARTIK KABUL EDİLMİYOR — bkz.
     kelimesel/challenge'daki açıklama. attempts=5 ile alınan token, tek bir yanlış
     tahminle günün şarkısını açıklatıyordu. Devam etme, imzalı token'ın
     localStorage'da saklanıp yeniden kullanılmasıyla yapılıyor. */
  return NextResponse.json({
    date,
    categoryId,
    audioUrl: challenge.audioUrl,
    attemptsToken: signAttemptsToken({ date, categoryId, attempts: 0 }),
  });
}

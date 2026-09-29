import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { MAX_LENGTH, MIN_LENGTH, type WordLength } from "@/lib/kelimesel";
import { getDailyWord, getServerTodayKey, signAttemptsToken } from "@/lib/kelimesel.server";

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
  const limited = await rateLimit(`kelimesel-challenge:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const lengthParam = Number(searchParams.get("length"));

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
  if (!Number.isInteger(lengthParam) || lengthParam < MIN_LENGTH || lengthParam > MAX_LENGTH) {
    return NextResponse.json({ error: "Geçersiz uzunluk." }, { status: 400 });
  }
  const length = lengthParam as WordLength;

  const answer = getDailyWord(date, length);
  if (!answer) {
    return NextResponse.json({ error: "Bu uzunluk için kelime bulunamadı." }, { status: 404 });
  }

  /* Bu uç HER ZAMAN sıfırdan başlayan bir token verir; istemcinin "kaç deneme
     yaptım" iddiası ARTIK KABUL EDİLMİYOR.
     Eskiden `attempts` parametresi client'tan alınıyordu ve bu, cevabı iki istekte
     sızdıran bir açıktı: attempts=5 ile token alınıp tek bir tahmin gönderildiğinde
     sunucu bunu son deneme sayıp günün kelimesini açıklıyordu (canlıda doğrulandı).
     Devam etme artık şöyle çalışıyor: sunucunun imzaladığı son attemptsToken
     localStorage'da saklanır ve yeniden kullanılır (bkz. useKelimesel). Token HMAC'li
     olduğu için uydurulamaz — son denemeye ulaşmak için gerçekten o kadar tahmin
     yapmak gerekir. */
  return NextResponse.json({
    date,
    length,
    attemptsToken: signAttemptsToken({ date, length, attempts: 0 }),
  });
}

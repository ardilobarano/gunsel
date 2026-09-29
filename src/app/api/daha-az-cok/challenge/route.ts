import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { DAHA_AZ_COK_CATEGORIES } from "@/lib/dahaAzCok";
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

export async function GET(request: Request) {
  const limited = await rateLimit(`dahaazcok-challenge:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const category = searchParams.get("category") ?? "";
  const token = searchParams.get("token") ?? "";

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
  if (!DAHA_AZ_COK_CATEGORIES.some((c) => c.id === category)) {
    return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
  }

  const sequence = await getDailySequence(date, category);
  if (!sequence) {
    return NextResponse.json({ error: "Bu kategori için veri bulunamadı." }, { status: 404 });
  }

  /* İlerleme, İSTEMCİNİN SÖYLEDİĞİNE göre değil KENDİ İMZAMIZA göre belirleniyor.
     Ham `stepIndex` parametresi kabul edilirken "4" denilerek zincirin 5 öğesi
     değerleriyle birlikte tek istekte alınabiliyordu (canlıda doğrulandı), bu
     yüzden kaldırılmıştı. Ama sabit 0 da yanlıştı: yarım kalmış bir oyuna geri
     dönüldüğünde (sekme değiştirip geri gelmek, sayfayı yenilemek) sıradaki öğe
     diye ZATEN OYNANMIŞ öğe dönüyordu; istemci saklı ilerlemesini koruduğu için
     iki kart da aynı öğeyi gösteriyor ve React "aynı key" hatası veriyordu
     (kullanıcı bildirdi: "şıkların ismi şekli falan bozuluyor").

     Doğrusu: adımı imzalı token söylüyor. Token'ı sunucu üretiyor ve HMAC ile
     imzalıyor, yani oyuncu oynamadan ileri bir adım için token üretemiyor.
     Geçersiz/eksik token sıfırdan başlatıyor. */
  const dogrulanan = token ? verifyAttemptsToken(token, { date, category }) : null;
  const stepIndex = dogrulanan?.stepIndex ?? 0;
  const correctCount = dogrulanan?.correctCount ?? 0;

  const revealedItems = sequence.slice(0, stepIndex + 1);
  const nextItem = sequence[stepIndex + 1];

  return NextResponse.json({
    date,
    category,
    stepIndex,
    correctCount,
    revealedItems,
    nextItem: { id: nextItem.id, label: nextItem.label, unit: nextItem.unit, imageUrl: nextItem.imageUrl },
    attemptsToken: signAttemptsToken({ date, category, stepIndex, correctCount }),
  });
}

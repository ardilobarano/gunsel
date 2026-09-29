import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { getServerTodayKey, getShuffledWords, signStateToken } from "@/lib/baglamsal.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RL_LIMIT = 120;
const RL_WINDOW_MS = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const limited = await rateLimit(`baglamsal-challenge:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";

  if (!DATE_RE.test(date) || date > getServerTodayKey()) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }
  if (!isWithinArchiveWindow(date, getServerTodayKey())) {
    return NextResponse.json({ error: "Bu tarih arşiv aralığının dışında." }, { status: 400 });
  }
  const erisim = await guardArchiveAccess(date, getServerTodayKey());
  if (!erisim.ok) {
    return NextResponse.json({ error: erisim.error }, { status: erisim.status });
  }

  /* SADECE karışık 16 kelime gidiyor — hangi kelimenin hangi gruba ait olduğu DEĞİL.
     Durum (çözülenler, hata sayısı) her zaman sıfırdan başlıyor; devam etme
     saklanan imzalı token'la oluyor (diğer oyunlardaki aynı düzeltme). */
  return NextResponse.json({
    date,
    words: getShuffledWords(date),
    stateToken: signStateToken({ date, solved: [], mistakes: 0 }),
  });
}

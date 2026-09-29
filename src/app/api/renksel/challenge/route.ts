import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { getGunlukSorular, getServerTodayKey, signTurToken, soruyuCiz } from "@/lib/renksel.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RL_LIMIT = 120;
const RL_WINDOW_MS = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const limited = await rateLimit(`renksel-challenge:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date) || date > getServerTodayKey()) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }
  if (!isWithinArchiveWindow(date, getServerTodayKey())) {
    return NextResponse.json({ error: "Bu tarih arşiv aralığının dışında." }, { status: 400 });
  }
  const erisim = await guardArchiveAccess(date, getServerTodayKey());
  if (!erisim.ok) return NextResponse.json({ error: erisim.error }, { status: erisim.status });

  /* TÜM turlar tek seferde gidiyor ama HİÇBİRİNİN cevabı gitmiyor: soruyuCiz
     yalnızca sorulan slotu boş bırakıp diğerlerini dolduruyor, doğru renk
     yanıta hiç girmiyor. Turları tek tek vermek de bir şey korumazdı, çünkü
     korunan şey sıradaki soru değil onun RENGİ. */
  const turlar = getGunlukSorular(date).map(soruyuCiz);

  return NextResponse.json({
    date,
    turlar,
    turToken: signTurToken({ date, tur: 0, toplam: 0 }),
  });
}

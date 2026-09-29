import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { recordDailyResult } from "@/lib/dailyResult.server";
import { GAME_ID, TUR_SAYISI } from "@/lib/renksel";
import {
  getServerTodayKey,
  signTurToken,
  turuPuanla,
  verifyTurToken,
} from "@/lib/renksel.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RL_LIMIT = 120;
const RL_WINDOW_MS = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function POST(request: Request) {
  const limited = await rateLimit(`renksel-guess:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    date?: string;
    tahmin?: string;
    turToken?: string;
  } | null;
  const date = body?.date ?? "";
  const tahmin = body?.tahmin ?? "";
  const turToken = body?.turToken ?? "";

  if (!DATE_RE.test(date) || date > getServerTodayKey()) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }
  if (!isWithinArchiveWindow(date, getServerTodayKey())) {
    return NextResponse.json({ error: "Bu tarih arşiv aralığının dışında." }, { status: 400 });
  }
  const erisim = await guardArchiveAccess(date, getServerTodayKey());
  if (!erisim.ok) return NextResponse.json({ error: erisim.error }, { status: erisim.status });
  if (!HEX_RE.test(tahmin)) {
    return NextResponse.json({ error: "Geçersiz renk." }, { status: 400 });
  }

  /* Kaçıncı turda olduğumuzu İMZALI TOKEN söylüyor. İstemci "tur 4"ü kendisi
     bildirebilseydi puanı da kendisi belirlerdi; toplam puan da token'da
     taşınıyor ki son turda uydurulmuş bir toplamla kayıt açılamasın. */
  const durum = verifyTurToken(turToken, date);
  if (!durum) return NextResponse.json({ error: "Geçersiz oturum." }, { status: 400 });

  const { puan, dogru } = turuPuanla(date, durum.tur, tahmin);
  const sonrakiTur = durum.tur + 1;
  const toplam = Math.round((durum.toplam + puan) * 10) / 10;
  const bitti = sonrakiTur >= TUR_SAYISI;

  if (bitti) {
    /* Renksel'de "kazandın/kaybettin" yok, puan var. Kayıt biçimi diğer
       oyunlarla aynı kalsın diye sonuç WON, guessCount ise 10 üzerinden
       ortalama puanın yuvarlanmışı (1-10) olarak yazılıyor — istatistik
       dağılımı böylece "kaç puan aldın" grafiğine dönüşüyor. */
    const ortalama = toplam / TUR_SAYISI;
    await recordDailyResult({
      gameId: GAME_ID,
      dateKey: date,
      status: "WON",
      guessCount: Math.max(1, Math.round(ortalama)),
    });
    return NextResponse.json({ puan, dogru, toplam, bitti: true });
  }

  return NextResponse.json({
    puan,
    dogru,
    toplam,
    bitti: false,
    turToken: signTurToken({ date, tur: sonrakiTur, toplam }),
  });
}

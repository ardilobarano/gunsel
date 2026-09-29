import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { gecerliKategori } from "@/lib/haritasal";
import {
  getBolgeOptions,
  getDailyBolge,
  getServerTodayKey,
  signAttemptsToken,
} from "@/lib/haritasal.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RL_LIMIT = 120;
const RL_WINDOW_MS = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const limited = await rateLimit(`haritasal-challenge:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const kategoriId = searchParams.get("kategori") ?? "";

  if (!DATE_RE.test(date) || date > getServerTodayKey()) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }
  if (!gecerliKategori(kategoriId)) {
    return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
  }
  if (!isWithinArchiveWindow(date, getServerTodayKey())) {
    return NextResponse.json({ error: "Bu tarih arşiv aralığının dışında." }, { status: 400 });
  }
  const erisim = await guardArchiveAccess(date, getServerTodayKey());
  if (!erisim.ok) {
    return NextResponse.json({ error: erisim.error }, { status: erisim.status });
  }

  const bolge = getDailyBolge(date, kategoriId);

  /* SADECE siluet gidiyor — bölgenin adı, bayrağı/plakası ve koordinatı DEĞİL. Path
     zaten 0-100 kutusuna normalize edilmiş, yani konum bilgisi de içermiyor.
     Seçenek listesi (havuzdaki adların tamamı) cevabı ele vermiyor, tahmin kutusu
     için gerekli. attempts her zaman 0: istemcinin bildirdiği ilerleme kabul
     edilmiyor, devam etme saklanan imzalı token'la oluyor (bkz. diğer oyunlardaki
     aynı düzeltme). */
  return NextResponse.json({
    date,
    path: bolge.path,
    options: getBolgeOptions(kategoriId),
    attemptsToken: signAttemptsToken({ date, kategoriId, attempts: 0 }),
  });
}

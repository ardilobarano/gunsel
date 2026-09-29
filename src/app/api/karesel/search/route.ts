import { NextResponse } from "next/server";
import { searchMovies } from "@/lib/tmdb.server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bu uç bizim TMDB anahtarımızı kullanıyor — kotamızı korumak için sınırlı.
 * Oyuncu 6 tahmin için yazarken 300ms debounce ile arattığından normal kullanımda
 * dakikada 30 istek fazlasıyla yeterli. */
const LIMIT = 30;
const WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const limited = await rateLimit(`karesel-search:${getClientKey(request)}`, LIMIT, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  /* Dizi sekmesi TMDB'nin TV ucunu kullanıyor: film ve dizi kimlik uzayları
     AYRI, yani aynı sayı hem bir filme hem bir diziye ait olabiliyor. Tür
     yanlış seçilirse tahmin kutusu bambaşka bir yapım listeler. */
  const tur = searchParams.get("kategori") === "dizi" ? "tv" : "movie";

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchMovies(q, 8, tur);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Arama başarısız oldu." }, { status: 502 });
  }
}

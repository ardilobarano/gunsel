import { NextResponse } from "next/server";
import { katalogdaAra, type AramaSonucu } from "@/lib/sarkiKatalogu.server";
import { searchSpotifyTracks } from "@/lib/spotify.server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tahmin kutusunun arama ucu.
 *
 * ÖNCE YEREL KATALOG, Spotify yalnızca sonuç ZAYIF kalırsa.
 *
 * Eskiden her arama doğrudan Spotify'a gidiyordu ve her istek Spotify'a 3-4
 * sorgu demekti. Bu sürdürülebilir değildi (ölçüldü, Ağustos 2026): Development
 * Mode'a uzun pencereli kota geldi, dolunca arama tamamen durdu ve `Retry-After`
 * 15 saat geldi; kota geliştirici hesabı başına sayıldığı için yeni uygulama
 * açmak da çözmüyor. Gerekçenin tamamı sarkiKatalogu.server.ts'te.
 *
 * Spotify BÜSBÜTÜN atılmadı çünkü katalog sonlu: oyuncunun aklındaki şarkı
 * içinde olmayabilir ve o zaman tahmin edilemez hâle gelir. Ama artık sadece
 * katalogun yetmediği azınlık sorguda devreye giriyor — istek hacmi bir kaç
 * mertebe düşüyor.
 *
 * Spotify hatası SESSİZCE yutuluyor: elde katalog sonuçları varken aramayı
 * tamamen başarısız saymak oyunu gereksiz yere durdururdu.
 */
const LIMIT = 120;
const WINDOW_MS = 60_000;
/** Bu sayıdan az sonuç varsa Spotify'dan takviye istenir. */
const YETERLI_SONUC = 4;
const TOPLAM = 8;

export async function GET(request: Request) {
  const limited = await rateLimit(`sarkisal-search:${getClientKey(request)}`, LIMIT, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results: AramaSonucu[] = katalogdaAra(q, TOPLAM);

  if (results.length < YETERLI_SONUC) {
    try {
      const ek = await searchSpotifyTracks(q, TOPLAM);
      /* Tekilleştirme başlık+sanatçıya göre, id'ye göre DEĞİL: aynı şarkı
         katalogda ve Spotify'da farklı track id'leriyle durabiliyor. */
      const gorulen = new Set(
        results.map((r) => `${r.title.toLocaleLowerCase("tr-TR")}|${r.artist.toLocaleLowerCase("tr-TR")}`)
      );
      for (const t of ek) {
        if (results.length >= TOPLAM) break;
        const anahtar = `${t.title.toLocaleLowerCase("tr-TR")}|${t.artist.toLocaleLowerCase("tr-TR")}`;
        if (gorulen.has(anahtar)) continue;
        gorulen.add(anahtar);
        results.push(t);
      }
    } catch {
      // Spotify kullanılamıyor — katalog sonuçlarıyla devam.
    }
  }

  return NextResponse.json({ results });
}

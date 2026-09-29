import "server-only";
import type { MovieResult } from "@/lib/karesel";

if (!process.env.TMDB_API_KEY) throw new Error("TMDB_API_KEY tanımlı değil.");
const API_KEY: string = process.env.TMDB_API_KEY;

interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
}

/** TMDB'nin TV kayıtları aynı alanları FARKLI ADLA taşıyor (title->name,
 *  original_title->original_name, release_date->first_air_date). Tek yerde
 *  normalize ediliyor ki aşağıdaki harmanlama iki tür için de aynen çalışsın. */
function normalize(ham: Record<string, unknown>): TmdbSearchResult {
  return {
    id: ham.id as number,
    title: (ham.title ?? ham.name) as string,
    original_title: (ham.original_title ?? ham.original_name) as string,
    release_date: (ham.release_date ?? ham.first_air_date) as string | undefined,
  };
}

async function searchOneLanguage(
  query: string,
  language: string,
  tur: "movie" | "tv"
): Promise<TmdbSearchResult[]> {
  const params = new URLSearchParams({
    api_key: API_KEY,
    query,
    language,
    include_adult: "false",
  });

  const res = await fetch(`https://api.themoviedb.org/3/search/${tur}?${params.toString()}`);
  if (!res.ok) throw new Error(`TMDB arama başarısız: ${res.status}`);

  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  return (data.results ?? []).map(normalize);
}

/**
 * Karesel'in tahmin kutusu için canlı TMDB film araması — Şarkısal'ın Spotify
 * proxy'siyle aynı rol. Havuzla (kareselMovies.json) sınırlı değil, kullanıcı
 * herhangi bir filmi tahmin edebilir; doğruluk kontrolü sunucuda tmdbId ile yapılıyor.
 *
 * Neden iki dil birden sorgulanıyor: TMDB'de `language` sadece dönen başlığı değil
 * SIRALAMAYI/eşleşmeyi de etkiliyor. Örneğin 2019 yapımı Parasite'ın Türkçe adı
 * "Parazit", orijinali Korece — kullanıcı "Parasite" yazdığında tr-TR sonuçlarının
 * ilk sayfasında hiç çıkmıyor, en-US'te çıkıyor. Tersi de geçerli ("Parazit" yazınca
 * tr-TR bulur). İkisini paralel sorgulayıp harmanlıyoruz.
 *
 * Neden popülerliğe göre sıralamıyoruz: TMDB'nin kendi alaka sırası daha isabetli.
 * "Alien" aramasında TMDB 1979 klasiğini başa koyuyor, popülerliğe göre sıralamak
 * ise 2024 yapımı Alien: Romulus'u öne çıkarıp aramayı bozuyordu.
 */
export async function searchMovies(
  query: string,
  limit = 8,
  /** Karesel'in "Dizi" sekmesi aynı akışı TMDB'nin TV ucuyla kullanıyor. */
  tur: "movie" | "tv" = "movie"
): Promise<MovieResult[]> {
  const q = query.trim();
  if (!q) return [];

  const [trResults, enResults] = await Promise.all([
    searchOneLanguage(q, "tr-TR", tur),
    searchOneLanguage(q, "en-US", tur),
  ]);

  // Aynı film iki listede de varsa Türkçe başlığını tercih et (uygulama Türkçe).
  const turkishTitleById = new Map(trResults.map((movie) => [movie.id, movie.title]));

  // Sırayı bozmadan harmanla: her iki listenin de ilk sırası en üstte yer alsın diye
  // index index dolaşıyoruz (tr[0], en[0], tr[1], en[1], ...), tekrarlar eleniyor.
  const merged: TmdbSearchResult[] = [];
  const seen = new Set<number>();
  const maxLength = Math.max(trResults.length, enResults.length);

  for (let i = 0; i < maxLength && merged.length < limit; i++) {
    for (const list of [trResults, enResults]) {
      const movie = list[i];
      if (!movie || seen.has(movie.id)) continue;
      seen.add(movie.id);
      merged.push(movie);
      if (merged.length >= limit) break;
    }
  }

  return merged.map((movie) => ({
    tmdbId: movie.id,
    title: turkishTitleById.get(movie.id) ?? movie.title,
    originalTitle: movie.original_title,
    year: movie.release_date ? movie.release_date.slice(0, 4) : null,
  }));
}

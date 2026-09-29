import "server-only";
import { trUpper } from "@/lib/utils";

if (!process.env.SPOTIFY_CLIENT_ID) throw new Error("SPOTIFY_CLIENT_ID tanımlı değil.");
if (!process.env.SPOTIFY_CLIENT_SECRET) throw new Error("SPOTIFY_CLIENT_SECRET tanımlı değil.");
const CLIENT_ID: string = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET: string = process.env.SPOTIFY_CLIENT_SECRET;

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify token alınamadı: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

function sanitizeFieldValue(value: string): string {
  // Tırnak temizliği: kullanıcının kendi alan filtresi enjekte edip (ör. "track:x OR artist:y")
  // "track:"/"artist:" daraltmasını bypass etmesini engelliyoruz.
  return value.replace(/"/g, "");
}

/**
 * Türkçe harfleri ASCII karşılıklarına indirger.
 *
 * NEDEN: Spotify'ın alan filtresi (track:/artist:) Türkçe İ'yi Latin I'ya KATLAMIYOR.
 * Ölçüldü: Pamela'nın "Istanbul" (Latin I'lı) şarkısı `track:"İstanbul"` ile hiç
 * bulunmuyor, `track:"Istanbul"` ile ilk sırada geliyor. Türk kullanıcı doğal olarak
 * dotlu İ yazacağı için bu, Türkçe karakterli her şarkıyı tahmin edilemez kılıyordu.
 * Ters yön sorun değil: ASCII sorgu, Türkçe karakterli başlıkları da buluyor.
 */
export function foldTurkish(value: string): string {
  return value
    /* Düzeltme işaretli harfler de katlanmalı: "Kâzım Koyuncu" katalogda â ile
       duruyor, kullanıcı doğal olarak "kazim" yazıyor ve eşleşme hiç olmuyordu
       (ölçüldü — sıfır sonuç). Aynısı "rüzgâr", "hâlâ", "sükût" için de geçerli. */
    .replace(/[âÂ]/g, (c) => (c === "Â" ? "A" : "a"))
    .replace(/[îÎ]/g, (c) => (c === "Î" ? "I" : "i"))
    .replace(/[ûÛ]/g, (c) => (c === "Û" ? "U" : "u"))
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
}

/** Tek bir yazımdan alan-kapsamlı sorgu varyasyonları üretir. */
function buildVariantsFor(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const queries: string[] = [];

  // "ezhel mar" gibi <sanatçı> + <şarkı> yazımları. Sanatçı adının kaç kelime olduğunu
  // bilmediğimiz için olası tüm sınır noktalarını deniyoruz. Kullanıcının hangi sırayla
  // yazdığını da bilemeyiz ("pamela istanbul" da olur "istanbul pamela" da) — bu yüzden
  // her bölünme iki yönde de sorgulanıyor.
  for (let k = 1; k < words.length; k++) {
    const head = sanitizeFieldValue(words.slice(0, k).join(" "));
    const tail = sanitizeFieldValue(words.slice(k).join(" "));
    queries.push(`artist:"${head}" track:"${tail}"`);
    queries.push(`track:"${head}" artist:"${tail}"`);
  }

  const full = sanitizeFieldValue(query.trim());
  queries.push(`track:"${full}"`);
  queries.push(`artist:"${full}"`);

  return queries;
}

/**
 * Kullanıcının yazdığı tek bir metinden birden fazla Spotify sorgu varyasyonu üretir —
 * amaç hem "sadece şarkı adı" (ör. "margiela"), hem "sadece sanatçı" (ör. "ezhel" ->
 * o sanatçının tüm şarkıları), hem de "sanatçı + şarkı adı birlikte" (ör. "ezhel mar" ->
 * Margiela) yazımını tek arama kutusunda desteklemek. Her varyasyon yine alan filtresiyle
 * (track:/artist:) daraltılmış kalıyor — düz/alansız arama şarkı sözü gibi geniş
 * metinlere de eşleştiği için kullanılmıyor.
 *
 * Hem kullanıcının yazdığı hâli hem Türkçe harfleri indirgenmiş hâli deneniyor (bkz.
 * foldTurkish). Sorgu zaten ASCII ise indirgenmiş hâli aynı çıkacağı için Set sayesinde
 * fazladan istek oluşmuyor.
 */
function buildFieldScopedQueries(query: string): string[] {
  const folded = foldTurkish(query);
  const queries = new Set<string>(buildVariantsFor(query));
  if (folded !== query) {
    for (const variant of buildVariantsFor(folded)) queries.add(variant);
  }
  return [...queries];
}

/**
 * Spotify'ın kendisi mi çuvalladı, yoksa gerçekten eşleşme mi yok?
 *
 * Bu ayrım ÖNEMLİ: eskiden başarısız istek sessizce boş liste dönüyordu
 * (`if (!res.ok) return []`), yani Spotify bizi hız sınırına aldığında oyuncu
 * "sonuç yok" görüyor ve kendi yazdığını yanlış sanıyordu — oyun oynanamaz
 * hâldeyken hiçbir yerde hata görünmüyordu. Bir kere tam olarak bu oldu:
 * toplu içerik hazırlarken kota tükendi ve canlıdaki arama kutusu saatlerce
 * boş sonuç döndü.
 */
export class SpotifyKullanilamiyor extends Error {
  constructor(readonly status: number) {
    super(`Spotify arama başarısız: ${status}`);
  }
}

export async function searchSpotifyTracks(query: string, limit = 8): Promise<SpotifyTrack[]> {
  const q = query.trim();
  if (!q) return [];

  const token = await getAccessToken();
  // Genel (alansız) arama Spotify'da şarkı sözü gibi geniş metinlere de eşleşiyor —
  // bu yüzden her zaman track:/artist: alan filtreleriyle daraltılmış birden fazla
  // sorgu varyasyonunu paralel deniyoruz (bkz. buildFieldScopedQueries), en alakalı
  // (sanatçı+şarkı birlikte eşleşen) sonuçlar önce gelecek şekilde birleştiriyoruz.
  const queries = buildFieldScopedQueries(q);

  const resultsPerQuery = await Promise.all(
    queries.map(async (qStr) => {
      const params = new URLSearchParams({ q: qStr, type: "track", market: "TR", limit: String(limit) });
      const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { hata: res.status, items: [] };
      const data = (await res.json()) as {
        tracks?: { items: { id: string; name: string; artists: { name: string }[]; duration_ms: number }[] };
      };
      return { hata: 0, items: data.tracks?.items ?? [] };
    })
  );

  /* Varyasyonların HEPSİ başarısızsa Spotify'ın kendisi kullanılamıyor demektir;
     bu durumda boş liste dönmek yerine haber veriyoruz ki çağıran yerel havuza
     düşebilsin. Bir kısmı başarısızsa (tek varyasyon hata verdiyse) elde kalan
     sonuçlarla devam etmek daha iyi. */
  const basarisiz = resultsPerQuery.find((r) => r.hata !== 0);
  if (basarisiz && resultsPerQuery.every((r) => r.hata !== 0)) {
    throw new SpotifyKullanilamiyor(basarisiz.hata);
  }

  const tracks = resultsPerQuery.flatMap((r) => r.items).map((track) => ({
    id: track.id,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    durationMs: track.duration_ms,
  }));

  // Aynı şarkının farklı sürümleri (single/albüm, farklı dağıtım) Spotify'da ayrı
  // track ID'leriyle geliyor ama başlık/sanatçı aynı — kullanıcıya aynı satır iki kez
  // görünmesin diye başlık+sanatçıya göre tekilleştiriyoruz, ilk (en alakalı) kaydı tutuyoruz.
  // Sorgu varyasyonları buildFieldScopedQueries'te en spesifikten (sanatçı+şarkı) en
  // genele (tek başına track/artist) doğru sıralı olduğu için bu öncelik korunuyor.
  const seen = new Set<string>();
  const deduped = tracks.filter((track) => {
    const key = `${trUpper(track.title)}|${trUpper(track.artist)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.slice(0, limit);
}

/**
 * Daha Az/Çok'un "Spotify" kategorisi için YouTube izlenme sayısı + video thumbnail'ini
 * çeker. SONG_PLAYBACK'teki (Şarkısal'ın sabit 12 şarkılık havuzu) her şarkı için
 * YouTube'da "<sanatçı> <başlık>" araması yapıp en alakalı videonun viewCount +
 * thumbnail URL'ini alır, sonucu src/data/songViewCounts.json'a yazar
 * (dahaAzCok.server.ts bunu statik okuyor — YouTube quota'sı çok düşük olduğu için
 * her istekte canlı çekilmiyor, bkz. quota notu).
 *
 * Çalıştırma: npm run daha-az-cok:fetch-youtube-views
 * Yeni bir şarkı SONG_PLAYBACK'e eklendiğinde tekrar çalıştırılmalı.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SONG_PLAYBACK } from "../src/data/songPlayback.server";
import songsData from "../src/data/songs.json";

interface Song {
  id: string;
  title: string;
  artist: string;
}

const songs = songsData as Song[];
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outPath = path.join(rootDir, "src", "data", "songViewCounts.json");

if (!process.env.YOUTUBE_API_KEY) {
  console.error("YOUTUBE_API_KEY tanımlı değil (.env.local kontrol et).");
  process.exit(1);
}
const API_KEY = process.env.YOUTUBE_API_KEY;

interface ViewCountEntry {
  viewCount: number;
  thumbnailUrl: string | null;
}

/**
 * Başlık eşleştirmesi için harfleri SADELEŞTİRİR: büyük harfe çevirip Türkçe
 * aksanlarını düşürür ve noktalama/boşlukları atar.
 *
 * Şart: YouTube'a yükleyenlerin çoğu aksansız yazıyor. Ölçüldü — "RESIMDEKI
 * GOZYASLARI" ve "Bir Kadin Çizeceksin" başlıklı yüklemeler, aksanlı aramayla
 * eşleşmediği için elenip çok daha küçük videolar seçiliyordu.
 */
function fold(value: string): string {
  return value
    .toLocaleUpperCase("tr-TR")
    .replace(/[İIı]/g, "I")
    .replace(/[ĞG]/g, "G")
    .replace(/[ÜU]/g, "U")
    .replace(/[ŞS]/g, "S")
    .replace(/[ÖO]/g, "O")
    .replace(/[ÇC]/g, "C")
    .replace(/[ÂA]/g, "A")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Şarkının YouTube'daki izlenmesi.
 *
 * ÖNEMLİ: ilk arama sonucu ALINMIYOR. Eskiden öyleydi ve metrik tutarsızdı —
 * aynı şarkının bir düzine yüklemesi var, ilk sonuç bazen asıl yükleme bazen
 * küçük bir akustik/re-upload oluyordu. Ölçüldü: Yeni Türkü "Olmasa Mektubun"
 * için 109 bin alınıyordu, asıl yükleme 17,6 milyondu (160 kat fark); Cem Karaca
 * için 534 bin alınıyordu, 13 milyonluk yükleme varken. "Hangisi daha çok
 * izlenmiş" oyununda bu, cevabı rastgeleye çeviriyordu.
 *
 * Artık ilk 5 sonucun istatistiği tek istekte alınıp, ŞARKI ADINI İÇEREN adaylar
 * arasından EN ÇOK İZLENEN seçiliyor. Ad filtresi şart: filtresiz "en çok izlenen"
 * bazen alakasız bir derleme/canlı yayın videosunu getiriyor.
 */
async function findViewCountAndThumbnail(query: string, title: string): Promise<ViewCountEntry | null> {
  const searchParams = new URLSearchParams({
    key: API_KEY,
    q: query,
    part: "id",
    type: "video",
    maxResults: "5",
    videoCategoryId: "10", // Music
  });
  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
  if (!searchRes.ok) throw new Error(`YouTube search başarısız (${searchRes.status}): ${await searchRes.text()}`);
  const searchData = (await searchRes.json()) as { items?: { id?: { videoId?: string } }[] };
  const videoIds = (searchData.items ?? []).map((i) => i.id?.videoId).filter(Boolean) as string[];
  if (videoIds.length === 0) return null;

  // Tek istekte hepsinin istatistiği + thumbnail'i (quota maliyeti 1 birim).
  const detailsParams = new URLSearchParams({ key: API_KEY, id: videoIds.join(","), part: "statistics,snippet" });
  const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`);
  if (!detailsRes.ok) throw new Error(`YouTube videos başarısız (${detailsRes.status}): ${await detailsRes.text()}`);
  const detailsData = (await detailsRes.json()) as {
    items?: {
      statistics?: { viewCount?: string };
      snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> };
    }[];
  };

  const aranan = fold(title);
  const adaylar = (detailsData.items ?? []).filter((v) => fold(v.snippet?.title ?? "").includes(aranan));
  const havuz = adaylar.length > 0 ? adaylar : (detailsData.items ?? []);
  const item = havuz.sort((a, b) => Number(b.statistics?.viewCount ?? 0) - Number(a.statistics?.viewCount ?? 0))[0];

  const viewCount = item?.statistics?.viewCount;
  if (!viewCount) return null;

  const thumbnails = item?.snippet?.thumbnails;
  // En yüksek çözünürlükten aşağı doğru dene — her video maxres/standard üretmiyor.
  const thumbnailUrl =
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    null;

  return { viewCount: Number(viewCount), thumbnailUrl };
}

async function main() {
  const result: Record<string, ViewCountEntry> = {};

  for (const songId of Object.keys(SONG_PLAYBACK)) {
    const song = songs.find((s) => s.id === songId);
    if (!song) {
      console.log(`[atlandı] ${songId}: songs.json'da bulunamadı`);
      continue;
    }

    const query = `${song.artist} ${song.title}`;
    const entry = await findViewCountAndThumbnail(query, song.title);
    if (entry === null) {
      console.log(`[uyarı] "${query}" için YouTube'da video bulunamadı, atlandı.`);
      continue;
    }

    console.log(`${songId} (${query}) -> ${entry.viewCount.toLocaleString("tr-TR")} izlenme, thumbnail: ${entry.thumbnailUrl ?? "yok"}`);
    result[songId] = entry;
  }

  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\n[tamamlandı] ${Object.keys(result).length} şarkı için veri yazıldı: src/data/songViewCounts.json`);
}

main();

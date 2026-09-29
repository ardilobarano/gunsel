/**
 * Masaüstünde (OneDrive) tarihe göre klasörlenmiş, kullanıcı tarafından indirilmiş
 * şarkı dosyalarını tarar ve her biri için scripts/prepare-sarkisal-audio.ts'in
 * yaptığı işi otomatik yapar: ffmpeg ile 16sn'lik klip kesip obfuscated adla
 * public/audio-secure/'a yazar, Spotify'da arayıp en iyi eşleşen track ID'yi bulur,
 * src/data/songOverrides.json'ı günceller.
 *
 * Beklenen klasör yapısı:
 *   <source>/DD.MM.YYYY/POP/Sanatçı - Şarkı Adı (opsiyonel ek metin).mp3
 *   <source>/DD.MM.YYYY/RAP/...
 *   <source>/DD.MM.YYYY/TÜMÜ/...
 * Sadece içinde en az bir .mp3 olan (tarih, kategori) çiftleri işlenir — boş
 * klasörler (ör. ileri bir tarih için henüz doldurulmamış) sessizce atlanır.
 *
 * Çalıştırma: npm run sarkisal:ingest-desktop
 *             npm run sarkisal:ingest-desktop -- --source "D:\başka\yol"
 */
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trUpper } from "../src/lib/utils";

const CLIP_SECONDS = 16;

/**
 * Kaynak dosyanın başındaki (encoder/dönüştürücüden kalma) sessizliği/neredeyse-
 * sessizliği atlayıp klibi gerçek ilk sesin geldiği sample'dan başlatır — elle
 * --start vermeye gerek kalmadan 0.1-0.2sn'lik gecikmeyi otomatik düzeltir.
 * start_periods=1: sadece BAŞTAKİ sessizliği kırpar (klip içindeki duraklamalara dokunmaz).
 * -t bu filtreden SONRA (bkz. execFileSync çağrıları) uygulanmalı ki süre kırpma
 * sonrası ses üzerinden hesaplansın, yoksa klip 16sn'den kısa çıkar.
 */
const SILENCE_TRIM_FILTER =
  "silenceremove=start_periods=1:start_duration=0:start_threshold=-35dB:detection=peak:window=0.01";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(rootDir, "public", "audio-secure");
const overridesPath = path.join(rootDir, "src", "data", "songOverrides.json");

const DEFAULT_SOURCE = "C:\\Users\\uardi\\OneDrive\\Masaüstü\\şarkısal";
const FFMPEG_BIN =
  "C:\\Users\\uardi\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";

if (!process.env.AUDIO_OBFUSCATION_SECRET) {
  console.error("AUDIO_OBFUSCATION_SECRET tanımlı değil (.env.local kontrol et).");
  process.exit(1);
}
if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET tanımlı değil (.env.local kontrol et).");
  process.exit(1);
}
const AUDIO_SECRET = process.env.AUDIO_OBFUSCATION_SECRET;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

/** src/lib/sarkisal.server.ts'teki getObfuscatedAudioPathForDay ile AYNI algoritma (script'ler server-only dosya import etmez, bkz. CLAUDE.md). */
function getObfuscatedAudioPathForDay(dateKey: string, categoryId: string): string {
  const token = createHmac("sha256", AUDIO_SECRET).update(`${dateKey}:${categoryId}`).digest("hex").slice(0, 20);
  return `/audio-secure/${token}.m4a`;
}

// --- Spotify arama (spotify.server.ts'in standalone script kopyası) ---

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token alınamadı: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function searchSpotifyTracks(query: string, limit = 10): Promise<SpotifyTrack[]> {
  const q = query.trim();
  if (!q) return [];

  const token = await getAccessToken();
  const sanitizedQuery = q.replace(/"/g, "");
  const params = new URLSearchParams({
    q: `track:"${sanitizedQuery}"`,
    type: "track",
    market: "TR",
    limit: String(limit),
  });

  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify arama başarısız: ${res.status}`);

  const data = (await res.json()) as {
    tracks?: { items: { id: string; name: string; artists: { name: string }[] }[] };
  };
  return (data.tracks?.items ?? []).map((t) => ({
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
  }));
}

async function findBestTrack(title: string, artist: string): Promise<SpotifyTrack | null> {
  const results = await searchSpotifyTracks(title);
  if (results.length === 0) return null;

  const normArtist = trUpper(artist);
  const artistMatch = results.find((r) => {
    const normResult = trUpper(r.artist);
    return normResult.includes(normArtist) || normArtist.includes(normResult);
  });
  return artistMatch ?? results[0];
}

// --- Dosya adı / klasör adı ayrıştırma ---

function parseDateFolder(name: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(name);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function categoryIdFromFolder(name: string): string | null {
  const upper = trUpper(name);
  if (upper === "POP") return "pop";
  if (upper === "RAP") return "rap";
  if (upper === "TÜMÜ" || upper === "TUMU") return "tumu";
  return null;
}

function parseTrackFilename(filename: string): { artist: string; title: string } {
  const base = filename.replace(/\.mp3$/i, "");
  const dashIndex = base.indexOf(" - ");
  let artist = "";
  let title = base;
  if (dashIndex !== -1) {
    artist = base.slice(0, dashIndex).trim();
    title = base.slice(dashIndex + 3).trim();
  }

  // "(Official Music Video)", "(Şarkı Sözleri Lyrics)" gibi sondaki parantez/köşeli
  // parça(lar) kaynağın video başlığından kalma gürültü — birden fazla olabileceği
  // için tek kalana kadar tekrar tekrar temizle.
  let prev: string;
  do {
    prev = title;
    title = title.replace(/\s*[([][^()[\]]*[)\]]\s*$/u, "").trim();
  } while (title !== prev);

  return { artist, title };
}

// --- Ana akış ---

function parseSourceArg(argv: string[]): string {
  const idx = argv.indexOf("--source");
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : DEFAULT_SOURCE;
}

async function main() {
  const sourceRoot = parseSourceArg(process.argv.slice(2));
  if (!existsSync(sourceRoot)) {
    console.error(`Kaynak klasör bulunamadı: ${sourceRoot}`);
    process.exit(1);
  }
  if (!existsSync(FFMPEG_BIN)) {
    console.error(`ffmpeg bulunamadı: ${FFMPEG_BIN}`);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const overrides = JSON.parse(readFileSync(overridesPath, "utf8")) as Record<
    string,
    Record<string, { title: string; artist: string; spotifyTrackId: string }>
  >;

  const dateFolders = readdirSync(sourceRoot, { withFileTypes: true }).filter((e) => e.isDirectory());
  let processed = 0;

  for (const dateFolder of dateFolders) {
    const dateKey = parseDateFolder(dateFolder.name);
    if (!dateKey) {
      console.log(`[atlandı] "${dateFolder.name}" DD.MM.YYYY biçiminde değil`);
      continue;
    }

    const dateDir = path.join(sourceRoot, dateFolder.name);
    const categoryFolders = readdirSync(dateDir, { withFileTypes: true }).filter((e) => e.isDirectory());

    for (const categoryFolder of categoryFolders) {
      const categoryId = categoryIdFromFolder(categoryFolder.name);
      if (!categoryId) {
        console.log(`[atlandı] "${categoryFolder.name}" bilinen bir kategori değil (pop/rap/tümü)`);
        continue;
      }

      const categoryDir = path.join(dateDir, categoryFolder.name);
      const mp3Files = readdirSync(categoryDir).filter((f) => /\.mp3$/i.test(f));
      if (mp3Files.length === 0) continue; // henüz doldurulmamış gün/kategori

      if (mp3Files.length > 1) {
        console.log(`[uyarı] ${dateKey}/${categoryId}: ${mp3Files.length} mp3 var, ilki kullanılıyor: ${mp3Files[0]}`);
      }

      const filename = mp3Files[0];
      const { artist, title } = parseTrackFilename(filename);
      console.log(`\n${dateKey} / ${categoryId}: "${filename}" -> sanatçı="${artist}" başlık="${title}"`);

      const track = await findBestTrack(title, artist);
      if (!track) {
        console.log(`[uyarı] Spotify'da eşleşme bulunamadı, bu (tarih, kategori) atlandı.`);
        continue;
      }
      console.log(`  Spotify eşleşmesi: "${track.title}" - ${track.artist} (${track.id})`);

      const sourcePath = path.join(categoryDir, filename);
      const outFilename = path.basename(getObfuscatedAudioPathForDay(dateKey, categoryId));
      const outPath = path.join(outDir, outFilename);

      execFileSync(FFMPEG_BIN, [
        "-y",
        "-ss",
        "0",
        "-i",
        sourcePath,
        "-af",
        SILENCE_TRIM_FILTER,
        "-t",
        String(CLIP_SECONDS),
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        outPath,
      ]);
      console.log(`  [üretildi] public/audio-secure/${outFilename}`);

      overrides[dateKey] = {
        ...overrides[dateKey],
        [categoryId]: { title, artist, spotifyTrackId: track.id },
      };
      processed++;
    }
  }

  writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`);
  console.log(`\n[tamamlandı] ${processed} (tarih, kategori) çifti işlendi, src/data/songOverrides.json güncellendi.`);
}

main();

/**
 * Bir YouTube linkinden Şarkısal günlük içeriği üretir — masaüstü klasörü akışının
 * (scripts/ingest-sarkisal-desktop.ts) elle indirme adımını ortadan kaldıran sürümü.
 *
 * Yaptığı iş: yt-dlp ile sesi indirir, ffmpeg ile (baştaki sessizliği kırparak)
 * 16 saniyelik klibi keser, obfuscated adla public/audio-secure/'a yazar, şarkıyı
 * Spotify'da bulup track ID'sini alır ve src/data/songOverrides.json'ı günceller.
 *
 * Tek şarkı:
 *   npm run sarkisal:youtube -- --url "https://youtu.be/XXXX" --date 2026-08-06 --category pop
 *
 * Toplu (her satır: tarih,kategori,link — # ile yorum satırı):
 *   npm run sarkisal:youtube -- --batch liste.txt
 *
 * Opsiyonel: --title "..." --artist "..." (YouTube başlığından yanlış çıkarsa elle ver)
 *            --start 45  (şarkının klip alınacak saniyesi, varsayılan 0)
 */
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trUpper } from "../src/lib/utils";

const CLIP_SECONDS = 16;

/** ingest-sarkisal-desktop.ts ile AYNI filtre — baştaki sessizliği/encoder gecikmesini
 * kırpıp klibi gerçek ilk sesin geldiği sample'dan başlatır. -t bu filtreden SONRA
 * uygulanmalı, yoksa klip 16sn'den kısa çıkar. */
/**
 * detection=rms (peak DEĞİL): peak modunda tek bir kısa çıtırtı/gürültü tepesi eşiği
 * aşınca filtre "ses başladı" sanıp kırpmayı durduruyordu. Ölçüldü — Pamela'nın
 * "İstanbul" klibinin ilk 0.2sn'si RMS olarak -48/-72 dB (kulakla sessiz) olmasına
 * rağmen kırpılmamıştı; Şarkısal'ın ilk aşaması tam 0.2sn olduğu için oyuncu o
 * aşamada hiçbir şey duymuyordu. RMS, pencere boyunca ortalama alıyor ve algılanan
 * ses seviyesine karşılık geliyor. window da 10ms'ten 50ms'e çıkarıldı ki tek tük
 * örnekler yerine gerçek bir ses akışı aransın.
 */
const SILENCE_TRIM_FILTER =
  "silenceremove=start_periods=1:start_duration=0:start_threshold=-40dB:detection=rms:window=0.05";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(rootDir, "public", "audio-secure");
const overridesPath = path.join(rootDir, "src", "data", "songOverrides.json");
const songsPath = path.join(rootDir, "src", "data", "songs.json");
const playbackPath = path.join(rootDir, "src", "data", "songPlayback.server.ts");

const FFMPEG_CANDIDATES = [
  "ffmpeg",
  "C:\\Users\\uardi\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe",
];
const YTDLP_CANDIDATES = [
  "yt-dlp",
  "C:\\Users\\uardi\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe",
];

/** PATH'te varsa onu, yoksa bilinen kurulum yolunu kullan (winget PATH'i yeni kabukta güncelliyor).
 * versionFlag araca göre değişiyor: ffmpeg tek tireli "-version" ister, "--version" ile
 * hata verip "bulunamadı" sanılmasına yol açıyor. */
function resolveBinary(candidates: string[], label: string, versionFlag: string): string {
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, [versionFlag], { stdio: "ignore" });
      return candidate;
    } catch {
      // sıradakini dene
    }
  }
  console.error(`${label} bulunamadı. Denenen yollar:\n  ${candidates.join("\n  ")}`);
  process.exit(1);
}

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

/** src/lib/sarkisal.server.ts'teki getObfuscatedAudioPathForDay ile AYNI algoritma
 * (script'ler server-only dosya import etmez, bkz. CLAUDE.md). */
function getObfuscatedAudioNameForDay(dateKey: string, categoryId: string): string {
  const token = createHmac("sha256", AUDIO_SECRET).update(`${dateKey}:${categoryId}`).digest("hex").slice(0, 20);
  return `${token}.m4a`;
}

/** Yedek havuzu için: ad songId'den türer (bkz. getObfuscatedAudioPathForSong).
 * Günlük dosyalardan FARKLI bir girdi kullanılıyor ki dosya adından şarkı çıkarılamasın. */
function getObfuscatedAudioNameForSong(songId: string): string {
  const token = createHmac("sha256", AUDIO_SECRET).update(songId).digest("hex").slice(0, 20);
  return `${token}.m4a`;
}

// --- Spotify (spotify.server.ts'in standalone script kopyası) ---

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  /** İsimden arama akışında YouTube adaylarını elemek için kullanılıyor. */
  durationMs: number;
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

/**
 * @param mode "track" alan filtresiyle arar (link akışı: elimizde ayrıştırılmış şarkı
 * adı var). "raw" sorguyu olduğu gibi geçer — isim akışında kullanıcı "Sanatçı - Şarkı"
 * yazdığı için alan filtresi eşleşmeyi bozardı.
 */
async function searchSpotify(query: string, limit = 10, mode: "track" | "raw" = "track"): Promise<SpotifyTrack[]> {
  const q = query.trim();
  if (!q) return [];

  const token = await getAccessToken();
  const params = new URLSearchParams({
    q: mode === "raw" ? q : `track:"${q.replace(/"/g, "")}"`,
    type: "track",
    market: "TR",
    limit: String(limit),
  });

  /* 429 (hız sınırı) YENİDEN DENENİYOR. Toplu modda her şarkı 3-4 arama yapıyor
     ve Spotify 25. şarkı civarında sınırı uyguluyor — bir parti tam da orada
     çökmüştü. Spotify `Retry-After` başlığında kaç saniye bekleneceğini
     söylüyor; söylemezse üstel geri çekilme. */
  let res: Response | undefined;
  for (let deneme = 0; deneme < 5; deneme++) {
    res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 429) break;
    const bekle = Number(res.headers.get("Retry-After")) || 2 ** deneme;
    /* ÜST SINIR ŞART: Spotify kota tükendiğinde Retry-After olarak 15 SAAT
       döndürebiliyor (ölçüldü: 55521 sn). Beklemeye kalkan script sessizce
       asılı kalıyordu — beklemek yerine hemen ve açıkça bırakmak gerekiyor. */
    if (bekle > 120) {
      throw new Error(
        `Spotify günlük kotası tükenmiş görünüyor: ${Math.round(bekle / 3600)} saat sonra tekrar dene ` +
          `(Retry-After: ${bekle} sn). Şimdiye kadar işlenenler kaydedildi.`,
      );
    }
    console.log(`  [Spotify 429] ${bekle} sn bekleniyor (deneme ${deneme + 1}/5)...`);
    await new Promise((r) => setTimeout(r, bekle * 1000));
  }
  if (!res || !res.ok) throw new Error(`Spotify arama başarısız: ${res?.status}`);

  const data = (await res.json()) as {
    tracks?: { items: { id: string; name: string; duration_ms: number; artists: { name: string }[] }[] };
  };
  return (data.tracks?.items ?? []).map((t) => ({
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    durationMs: t.duration_ms,
  }));
}

/**
 * İsim akışının ilk adımı: "Sezen Aksu - Firuze" gibi serbest bir metinden Spotify'daki
 * KANONİK kaydı bulur. Sıralamayı Spotify'a bırakmak yerine önce serbest metinle, sonra
 * (varsa) tire ile ayrılmış sanatçı/şarkı ile ayrı ayrı arayıp sanatçısı tutan ilk
 * sonucu seçiyor — "Firuze" tek başına aranınca alakasız cover'lar başa geliyor.
 */
async function resolveTrackByName(name: string): Promise<SpotifyTrack | null> {
  const dash = name.indexOf(" - ");
  const left = dash === -1 ? "" : name.slice(0, dash).trim();
  const right = dash === -1 ? name.trim() : name.slice(dash + 3).trim();

  const free = await searchSpotify(name, 10, "raw");
  if (!left) return free[0] ?? null;

  // "Sanatçı - Şarkı" mı yoksa "Şarkı - Sanatçı" mı belli değil; ikisini de dene.
  const candidates = [...free];
  for (const [artist, title] of [
    [left, right],
    [right, left],
  ]) {
    const hit = await findBestTrack(title, artist);
    if (hit) candidates.push(hit);
  }

  const wantedA = trUpper(left);
  const wantedB = trUpper(right);
  /* Alt dize kontrolü TEK BAŞINA yetmiyor: "Git", "Zoruna mı Gitti"nin içinde
     geçtiği için kısa bir şarkı adı bambaşka bir parçayı doğrulanmış gibi
     gösteriyordu (ölçüldü). Kısa olanın uzun olanın en az %60'ı kadar olması da
     aranıyor — "GİT" / "ZORUNA MI GİTTİ" oranı %20, eleniyor. */
  /* Spotify başlıkları sık sık ek taşıyor: "Galiba - Orijinal Rap Versiyon",
     "Şımarık (Remastered)". Bunlar AYNI şarkı, oran kuralına takılmamalılar —
     bir kere takıldılar da. Bu yüzden önce " - " sonrası ve parantez içi atılıp
     çekirdek ad karşılaştırılıyor. */
  const cekirdek = (s: string) =>
    s.split(" - ")[0].replace(/\s*[([].*$/, "").trim();
  const yakinKapsar = (x: string, y: string) => {
    const a = cekirdek(x);
    const b = cekirdek(y);
    if (a === b) return true;
    const [kisa, uzun] = a.length <= b.length ? [a, b] : [b, a];
    return uzun.includes(kisa) && kisa.length >= uzun.length * 0.6;
  };
  const matches = (t: SpotifyTrack) => {
    const a = trUpper(t.artist);
    const s = trUpper(t.title);
    /* Sanatçıda oran aranmıyor: "Ezhel, Red, Emrah..." gibi çok sanatçılı
       kayıtlarda istenen ad haklı olarak küçük bir parça kalıyor. */
    const sanatciTutar = a.includes(wantedA) || wantedA.includes(a);
    return sanatciTutar && yakinKapsar(s, wantedB);
  };
  sonEslesmeKesin = true;
  const strict = candidates.find((t) => matches(t));
  if (strict) return strict;

  /* Sanatçısı tutan ama ŞARKI ADI TUTMAYAN sonuç. Yazım hatalarını kurtarıyor
     ama sessiz bir tuzağı da var: var olmayan bir şarkı adı verildiğinde Spotify
     o sanatçının popüler bir parçasını döndürüyor ve script bunu sorunsuz kabul
     ediyordu. Ölçüldü: 10 şarkılık bir denemede 9'u böyle yanlış eşleşti
     ("Uzi - Sekiz" -> Ezhel'in "Sekiz 2"si, "Heijan - Beton" -> "İmparator").
     Artık kesin değil diye işaretleniyor; toplu modda varsayılan olarak
     atlanıyor (bkz. --gevsek). */
  const byArtist = candidates.find((t) => {
    const a = trUpper(t.artist);
    return a.includes(wantedA) || wantedA.includes(a) || a.includes(wantedB) || wantedB.includes(a);
  });
  const gevsek = byArtist ?? candidates[0] ?? null;
  if (gevsek) sonEslesmeKesin = false;
  return gevsek;
}

/** resolveTrackByName'in son çağrısı şarkı adını da tutturdu mu? */
let sonEslesmeKesin = true;
/** --gevsek verildi mi (bkz. main). */
let GEVSEK = false;

async function findBestTrack(title: string, artist: string): Promise<SpotifyTrack | null> {
  const results = await searchSpotify(title);
  if (results.length === 0) return null;

  const normArtist = trUpper(artist);
  if (!normArtist) return results[0];

  const artistMatch = results.find((r) => {
    const normResult = trUpper(r.artist);
    return normResult.includes(normArtist) || normArtist.includes(normResult);
  });
  return artistMatch ?? results[0];
}

// --- YouTube ---

interface YoutubeMeta {
  title: string;
  /** Müzik videolarında yt-dlp bunları doldurur; klip/canlı videolarda boş gelebilir. */
  track?: string;
  artist?: string;
  uploader?: string;
}

function fetchYoutubeMeta(ytdlp: string, url: string): YoutubeMeta {
  const json = execFileSync(ytdlp, ["--dump-single-json", "--no-playlist", "--no-warnings", url], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const data = JSON.parse(json) as YoutubeMeta;
  return data;
}

/** yt-dlp'nin track/artist alanları varsa onları, yoksa "Sanatçı - Şarkı" başlığını ayrıştırır. */
function deriveTitleArtist(meta: YoutubeMeta): { title: string; artist: string } {
  if (meta.track && meta.artist) return { title: meta.track, artist: meta.artist };

  const base = meta.title ?? "";
  const dashIndex = base.indexOf(" - ");
  let artist = meta.artist ?? meta.uploader ?? "";
  let title = base;
  if (dashIndex !== -1) {
    artist = base.slice(0, dashIndex).trim();
    title = base.slice(dashIndex + 3).trim();
  }

  // "(Official Video)", "[Lyrics]" gibi sondaki parça(lar) video başlığından kalma gürültü.
  let prev: string;
  do {
    prev = title;
    title = title.replace(/\s*[([][^()[\]]*[)\]]\s*$/u, "").trim();
  } while (title !== prev);

  return { title, artist };
}

interface YoutubeCandidate {
  id: string;
  title: string;
  channel: string;
  /** Saniye. 0 ise yt-dlp süreyi vermemiş demektir, aday elenir. */
  duration: number;
}

/** Oyunun ilk saniyeleri stüdyo kaydı olmalı — bu kelimeleri içeren videolar elenir. */
const BAD_TITLE_RE =
  /(\blive\b|canlı|konser|cover|karaoke|akustik|acoustic|remix|mashup|nightcore|sped\s*up|speed\s*up|slowed|reverb|hızlandırılmış|yavaşlatılmış|instrumental|enstrümantal|\b8d\b|tepki|reaction)/iu;

function youtubeSearch(ytdlp: string, query: string, count = 8): YoutubeCandidate[] {
  const out = execFileSync(
    ytdlp,
    ["--dump-json", "--flat-playlist", "--no-warnings", `ytsearch${count}:${query}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );

  return out
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .map((e) => ({
      id: String(e.id ?? ""),
      title: String(e.title ?? ""),
      channel: String(e.channel ?? e.uploader ?? ""),
      duration: Number(e.duration) || 0,
    }))
    .filter((c) => c.id);
}

/**
 * İsim akışının ikinci adımı. Sıralamayı YouTube'a bırakmak riskli: canlı kayıt,
 * cover ya da hızlandırılmış sürüm gelirse oyunun çaldığı ilk saniyeler yanlış olur.
 * Bu yüzden Spotify'daki SÜRE hakem olarak kullanılıyor ve YouTube Music'in otomatik
 * "- Topic" kanalları tercih ediliyor — onlar birebir albüm kaydı.
 */
function pickBestVideo(
  candidates: YoutubeCandidate[],
  track: SpotifyTrack
): { video: YoutubeCandidate; diff: number; certain: boolean } | null {
  const targetSec = track.durationMs / 1000;
  const spotifyTitle = trUpper(track.title);

  const scored = candidates
    .filter((c) => c.duration > 0 && !BAD_TITLE_RE.test(c.title))
    .map((c) => {
      const diff = Math.abs(c.duration - targetSec);
      const topic = /-\s*Topic$/i.test(c.channel);
      /* Kanal adı sanatçının kendisiyse (resmî kanal) bu, süresi biraz kayan bir
         adayı bile en güvenilir kaynak yapar. */
      const officialChannel = trUpper(c.channel) === trUpper(track.artist);
      /* Parantez içinde FARKLI BİR DÜZENLEME belirten niteleyici. "version" bilerek
         listede yok: "(Album Version)" tam olarak istediğimiz kayıt, cezalandırılmamalı.
         Süre tek başına yetmiyor — Sertab Erener'in "Radio Edit"i orijinalle birebir
         167 sn çıkıyor. */
      const altVersion = /[([][^)\]]*(radio\s*edit|\bedit\b|\bmix\b|remix|club|extended|\bdub\b|karaoke|instrumental)[^)\]]*[)\]]/iu.test(
        c.title
      );
      const titleMatches = trUpper(c.title).includes(spotifyTitle);

      let score = diff;
      if (topic || officialChannel) score -= 6;
      if (titleMatches) score -= 2;
      if (altVersion) score += 30;

      return { video: c, diff, topic, altVersion, score };
    })
    .sort((a, b) => a.score - b.score);

  if (scored.length === 0) return null;

  // Topic kanalı + süre neredeyse birebir: albüm kaydı olduğundan eminiz.
  const topicExact = scored.find((s) => s.topic && s.diff <= 3 && !s.altVersion);
  if (topicExact) return { video: topicExact.video, diff: topicExact.diff, certain: true };

  const best = scored[0];
  // Klip versiyonlarında intro/outro yüzünden 20 sn'ye kadar fark normal; ötesi şüpheli.
  return { video: best.video, diff: best.diff, certain: best.diff <= 20 && !best.altVersion };
}

function downloadAudio(ytdlp: string, url: string, workDir: string): string {
  execFileSync(
    ytdlp,
    ["-f", "bestaudio/best", "--no-playlist", "--no-warnings", "-o", path.join(workDir, "audio.%(ext)s"), url],
    { stdio: "inherit" }
  );

  const files = readdirSync(workDir).filter((f) => f.startsWith("audio."));
  if (files.length === 0) throw new Error("yt-dlp ses dosyası üretmedi.");
  return path.join(workDir, files[0]);
}

// --- Argümanlar ---

interface Job {
  /** Havuz işlerinde kullanılmaz. */
  dateKey: string;
  categoryId: string;
  /** İkisinden biri dolu: doğrudan link, ya da "Sanatçı - Şarkı" adı. */
  url?: string;
  song?: string;
  /** Doluysa bu bir YEDEK HAVUZ kaydı: dosya adı songId'den türer ve songs.json +
   *  songPlayback.server.ts güncellenir. */
  poolId?: string;
  /** Havuz kaydının songs.json'daki türü ("Pop" | "Rap" | ...). "Tümü" sekmesi tüm
   *  türlerden çekiyor, Pop/Rap sekmeleri sadece kendi etiketinden. */
  genre?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES = new Set(["tumu", "pop", "rap"]);

function normalizeCategory(raw: string): string | null {
  const upper = trUpper(raw.trim());
  if (upper === "POP") return "pop";
  if (upper === "RAP") return "rap";
  if (upper === "TÜMÜ" || upper === "TUMU") return "tumu";
  return CATEGORIES.has(raw.trim()) ? raw.trim() : null;
}

function getArg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : undefined;
}

function parseJobs(argv: string[]): Job[] {
  const poolBatchPath = getArg(argv, "pool-batch");
  if (poolBatchPath) {
    const lines = readFileSync(poolBatchPath, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    return lines.map((line, i) => {
      // Şarkı adında virgül olabilir — sadece ilk iki virgülden bölünüyor.
      const a = line.indexOf(",");
      const b = line.indexOf(",", a + 1);
      const poolId = a === -1 ? "" : line.slice(0, a).trim();
      const genre = b === -1 ? "" : line.slice(a + 1, b).trim();
      const song = b === -1 ? "" : line.slice(b + 1).trim();
      if (!poolId || !genre || !song) {
        console.error(
          `Havuz dosyasının ${i + 1}. satırı geçersiz: "${line}"\nBeklenen biçim: pop-07,Pop,Tarkan - Kuzu Kuzu`
        );
        process.exit(1);
      }
      return { dateKey: "", categoryId: "", poolId, genre, song };
    });
  }

  const batchPath = getArg(argv, "batch");

  if (batchPath) {
    const lines = readFileSync(batchPath, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    return lines.map((line, i) => {
      // Şarkı adında virgül olabildiği için sadece İLK İKİ virgülden bölünüyor.
      const firstComma = line.indexOf(",");
      const secondComma = line.indexOf(",", firstComma + 1);
      const date = firstComma === -1 ? "" : line.slice(0, firstComma).trim();
      const category = secondComma === -1 ? "" : line.slice(firstComma + 1, secondComma).trim();
      const rest = secondComma === -1 ? "" : line.slice(secondComma + 1).trim();
      const categoryId = category ? normalizeCategory(category) : null;

      if (!date || !DATE_RE.test(date) || !categoryId || !rest) {
        console.error(
          `Toplu dosyanın ${i + 1}. satırı geçersiz: "${line}"\n` +
            "Beklenen biçim: 2026-08-06,pop,https://...  ya da  2026-08-06,pop,Sezen Aksu - Firuze"
        );
        process.exit(1);
      }
      return /^https?:\/\//i.test(rest)
        ? { dateKey: date, categoryId, url: rest }
        : { dateKey: date, categoryId, song: rest };
    });
  }

  const date = getArg(argv, "date");
  const category = getArg(argv, "category");
  const url = getArg(argv, "url");
  const song = getArg(argv, "song");
  const categoryId = category ? normalizeCategory(category) : null;

  if (!date || !DATE_RE.test(date) || !categoryId || (!url && !song)) {
    console.error(
      'Kullanım:\n  npm run sarkisal:youtube -- --song "Sezen Aksu - Firuze" --date 2026-08-06 --category pop\n' +
        '  npm run sarkisal:youtube -- --url "<link>" --date 2026-08-06 --category pop|rap|tumu\n' +
        "  npm run sarkisal:youtube -- --batch liste.txt\n" +
        'Opsiyonel: --title "..." --artist "..." --start 45'
    );
    process.exit(1);
  }
  return [{ dateKey: date, categoryId, ...(url ? { url } : { song }) }];
}

// --- Ana akış ---

async function main() {
  const argv = process.argv.slice(2);
  const jobs = parseJobs(argv);
  const overrideTitle = getArg(argv, "title");
  const overrideArtist = getArg(argv, "artist");
  const startSeconds = Number(getArg(argv, "start") ?? 0) || 0;
  /** --dry: hiçbir şey indirmeden/yazmadan sadece hangi kaydın seçildiğini gösterir.
   *  İsim akışında yayına almadan önce eşleşmeyi doğrulamak için. */
  const dryRun = argv.includes("--dry");
  /** --gevsek: şarkı adı tutmasa bile sanatçısı tutan kaydı kabul et.
   *  Varsayılan KAPALI — açıkken yanlış şarkı sessizce yayına girebiliyor. */
  GEVSEK = argv.includes("--gevsek");

  const ffmpeg = resolveBinary(FFMPEG_CANDIDATES, "ffmpeg", "-version");
  const ytdlp = resolveBinary(YTDLP_CANDIDATES, "yt-dlp", "--version");

  mkdirSync(outDir, { recursive: true });
  const overrides = JSON.parse(readFileSync(overridesPath, "utf8")) as Record<
    string,
    Record<string, { title: string; artist: string; spotifyTrackId: string }>
  >;

  let processed = 0;
  const poolEntries: { id: string; title: string; artist: string; genre: string; spotifyTrackId: string }[] = [];

  const basarisiz: string[] = [];

  for (const job of jobs) {
    const workDir = mkdtempSync(path.join(os.tmpdir(), "sarkisal-yt-"));
    try {
      console.log(`\n=== ${job.poolId ? `HAVUZ ${job.poolId} (${job.genre})` : `${job.dateKey} / ${job.categoryId}`} ===`);

      let track: SpotifyTrack | null;
      let sourceUrl: string;
      let title: string;
      let artist: string;

      if (job.song) {
        // İSİM AKIŞI: önce Spotify (kanonik ad + süre), sonra o bilgiyle YouTube araması.
        // Ters sıra riskli olurdu — YouTube'un ilk sonucu canlı/cover olabilir ve
        // oyunun çaldığı ilk saniyeler yanlış şarkıya ait olurdu.
        console.log(`isim: ${job.song}`);
        track = await resolveTrackByName(job.song);
        if (!track) {
          console.log("[uyarı] Spotify'da eşleşme bulunamadı — atlandı. --url ile link vererek geçebilirsin.");
          continue;
        }
        title = overrideTitle ?? track.title;
        artist = overrideArtist ?? track.artist;
        const dur = Math.round(track.durationMs / 1000);
        console.log(`  Spotify: "${track.title}" - ${track.artist} (${track.id}, ${dur} sn)`);

        /* Şarkı adı tutmadıysa bu BAŞKA bir parça. Sessizce kabul etmek, yanlış
           şarkının o günün cevabı olması demek — varsayılan olarak atlanıyor. */
        if (!sonEslesmeKesin && !overrideTitle) {
          console.log(
            `  [ATLANDI] İstenen "${job.song}" ile bulunan "${track.artist} - ${track.title}" farklı.` +
              ` Şarkı adını düzelt, --url ile link ver ya da bilerek istiyorsan --gevsek ekle.`,
          );
          if (!GEVSEK) continue;
          console.log("  --gevsek verildi, yine de devam ediliyor.");
        }

        const query = `${track.artist} ${track.title}`;
        const best = pickBestVideo(youtubeSearch(ytdlp, query), track);
        if (!best) {
          console.log("[uyarı] Uygun YouTube videosu bulunamadı — atlandı. --url ile link verebilirsin.");
          continue;
        }
        sourceUrl = `https://www.youtube.com/watch?v=${best.video.id}`;
        console.log(`  YouTube: "${best.video.title}" — ${best.video.channel} (${best.video.duration} sn)`);
        console.log(`           ${sourceUrl}`);
        if (!best.certain) {
          console.log(
            `  [DİKKAT] Süre farkı ${Math.round(best.diff)} sn. Yanlış sürüm olabilir — /onizleme'den dinleyip doğrula.`
          );
        }
      } else {
        // LİNK AKIŞI: başlıktan sanatçı/şarkı çıkarılıp Spotify'da doğrulanıyor.
        sourceUrl = job.url!;
        console.log(`link: ${sourceUrl}`);
        const meta = fetchYoutubeMeta(ytdlp, sourceUrl);
        const derived = deriveTitleArtist(meta);
        title = overrideTitle ?? derived.title;
        artist = overrideArtist ?? derived.artist;
        console.log(`YouTube başlığı: "${meta.title}"`);
        console.log(`  -> sanatçı="${artist}" şarkı="${title}"`);

        track = await findBestTrack(title, artist);
        if (!track) {
          console.log("[uyarı] Spotify'da eşleşme bulunamadı — bu şarkı atlandı (tahmin doğrulaması track ID'ye bağlı).");
          continue;
        }
        console.log(`  Spotify eşleşmesi: "${track.title}" - ${track.artist} (${track.id})`);
      }

      if (dryRun) {
        console.log("  [kuru çalıştırma] indirme ve kayıt yapılmadı.");
        continue;
      }

      const sourcePath = downloadAudio(ytdlp, sourceUrl, workDir);
      const outName = job.poolId
        ? getObfuscatedAudioNameForSong(job.poolId)
        : getObfuscatedAudioNameForDay(job.dateKey, job.categoryId);
      const outPath = path.join(outDir, outName);

      execFileSync(ffmpeg, [
        "-y",
        "-ss",
        String(startSeconds),
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
      console.log(`  [üretildi] public/audio-secure/${outName}`);

      if (job.poolId) {
        poolEntries.push({
          id: job.poolId,
          title,
          artist,
          genre: job.genre!,
          spotifyTrackId: track.id,
        });
      } else {
        overrides[job.dateKey] = {
          ...overrides[job.dateKey],
          [job.categoryId]: { title, artist, spotifyTrackId: track.id },
        };
        /* HER ŞARKIDAN SONRA yazılıyor, parti sonunda değil. Bir kere 39
           şarkılık parti 25. şarkıda Spotify 429 ile çöktü: ses dosyalarının
           hepsi diske yazılmıştı ama takvim güncellenmediği için hiçbiri
           kullanılamıyordu, iş tamamen boşa gitti. */
        writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`);
      }
      processed++;
    } catch (e) {
      /* TEK ŞARKI PARTİYİ BATIRMASIN. YouTube arada bir 403 döndürüyor
         (geçici, aynı video birkaç dakika sonra sorunsuz iniyor) ve bu hata
         39 şarkılık bir partiyi İLK şarkıda bitirmişti — 38'i hiç denenmedi.
         Başarısız gün atlanıp devam ediliyor, sonunda listesi basılıyor;
         o günler yedek havuza düşer, tekrar çalıştırınca tamamlanır. */
      const mesaj = e instanceof Error ? e.message.split("\n")[0] : String(e);
      console.log(`  [HATA] ${job.dateKey}/${job.categoryId ?? job.poolId}: ${mesaj}`);
      basarisiz.push(`${job.dateKey}/${job.categoryId ?? job.poolId}`);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  if (poolEntries.length > 0) {
    // songs.json — id'ye göre upsert (yeniden üretilen havuz şarkısı çift kayıt oluşturmasın).
    const songs = JSON.parse(readFileSync(songsPath, "utf8")) as {
      id: string;
      title: string;
      artist: string;
      genre: string;
    }[];
    for (const e of poolEntries) {
      const existing = songs.findIndex((s) => s.id === e.id);
      const row = { id: e.id, title: e.title, artist: e.artist, genre: e.genre };
      if (existing === -1) songs.push(row);
      else songs[existing] = row;
    }
    songs.sort((a, b) => a.id.localeCompare(b.id));
    writeFileSync(songsPath, `${JSON.stringify(songs, null, 2)}\n`);

    // songPlayback.server.ts — nesnenin kapanış satırından önce satır ekle/güncelle.
    let src = readFileSync(playbackPath, "utf8");
    for (const e of poolEntries) {
      const line = `  "${e.id}": { spotifyTrackId: "${e.spotifyTrackId}" }, // ${e.artist} - ${e.title}`;
      const re = new RegExp(`^\\s*"${e.id}":.*$`, "m");
      if (re.test(src)) {
        src = src.replace(re, line);
      } else {
        const close = src.indexOf("\n};");
        if (close === -1) throw new Error("songPlayback.server.ts'te SONG_PLAYBACK nesnesinin sonu bulunamadı.");
        src = `${src.slice(0, close)}\n${line}${src.slice(close)}`;
      }
    }
    writeFileSync(playbackPath, src);
    console.log(`\n[havuz] ${poolEntries.length} kayıt songs.json + songPlayback.server.ts'e yazıldı.`);
  }

  if (processed > 0 && poolEntries.length === 0) {
    writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`);
  }
  console.log(`\n[tamamlandı] ${processed}/${jobs.length} şarkı işlendi.`);
  if (processed > 0) {
    console.log("Yayına almak için: git add -A && git commit && git push");
  }
}

main();

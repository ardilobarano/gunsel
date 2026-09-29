import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SONG_CATEGORIES } from "../src/lib/sarkisal";

/** Şarkının başından itibaren en uzun aşama (15sn) rahatça kapsansın diye üretilen
 * klip biraz cömert tutuluyor. */
const CLIP_SECONDS = 16;

/**
 * --start ile verilen kaba başlangıç noktasındaki artık sessizliği/neredeyse-
 * sessizliği atlayıp klibi gerçek ilk sesin geldiği sample'dan başlatır — elle
 * saniye hassasiyetinde --start ayarlamaya gerek kalmadan 0.1-0.2sn'lik
 * gecikmeyi otomatik düzeltir. start_periods=1: sadece BAŞTAKİ sessizliği kırpar.
 * -t bu filtreden SONRA uygulanmalı ki süre kırpma sonrası ses üzerinden
 * hesaplansın, yoksa klip 16sn'den kısa çıkar.
 */
const SILENCE_TRIM_FILTER =
  "silenceremove=start_periods=1:start_duration=0:start_threshold=-35dB:detection=peak:window=0.01";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(rootDir, "public", "audio-secure");
const overridesPath = path.join(rootDir, "src", "data", "songOverrides.json");

if (!process.env.AUDIO_OBFUSCATION_SECRET) {
  console.error("AUDIO_OBFUSCATION_SECRET tanımlı değil (.env.local kontrol et).");
  process.exit(1);
}
const AUDIO_SECRET = process.env.AUDIO_OBFUSCATION_SECRET;

/**
 * src/lib/sarkisal.server.ts'teki getObfuscatedAudioPathForDay ile AYNI algoritma —
 * o dosya "server-only" paketiyle korunuyor (Next.js dışında/tsx ile çalıştırılınca
 * fırlatıyor), bu yüzden burada bilinçli olarak küçük bir kopyası tutuluyor.
 */
function getObfuscatedAudioPathForDay(dateKey: string, categoryId: string): string {
  const token = createHmac("sha256", AUDIO_SECRET)
    .update(`${dateKey}:${categoryId}`)
    .digest("hex")
    .slice(0, 20);
  return `/audio-secure/${token}.m4a`;
}

function ensureFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.error("ffmpeg bulunamadı. Kurulum: brew install ffmpeg");
    process.exit(1);
  }
}

interface Args {
  date: string;
  category: string;
  file: string;
  title: string;
  artist: string;
  spotify: string;
  start: number;
}

function printUsage() {
  console.error(
    `Kullanım:\n` +
      `  npm run sarkisal:prepare-audio -- --date 2026-08-05 --category pop \\\n` +
      `    --file ~/Downloads/sarki.mp3 --title "Şarkı Adı" --artist "Sanatçı" \\\n` +
      `    --spotify <spotifyTrackId> [--start 12]\n\n` +
      `  --category: ${SONG_CATEGORIES.map((c) => c.id).join(" | ")}\n` +
      `  --start: kaynak dosyada şarkının gerçekten başladığı saniye (varsayılan 0)`
  );
}

function parseArgs(argv: string[]): Args {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) {
      printUsage();
      process.exit(1);
    }
    values[key.slice(2)] = value;
  }

  const { date, category, file, title, artist, spotify, start } = values;
  if (!date || !category || !file || !title || !artist || !spotify) {
    printUsage();
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`Geçersiz --date: ${date} (beklenen biçim: YYYY-MM-DD)`);
    process.exit(1);
  }
  if (!SONG_CATEGORIES.some((c) => c.id === category)) {
    console.error(`Geçersiz --category: ${category} (${SONG_CATEGORIES.map((c) => c.id).join(", ")})`);
    process.exit(1);
  }

  return { date, category, file, title, artist, spotify, start: start ? Number(start) : 0 };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  ensureFfmpeg();
  mkdirSync(outDir, { recursive: true });

  const sourcePath = path.resolve(args.file);
  if (!existsSync(sourcePath)) {
    console.error(`Kaynak dosya bulunamadı: ${sourcePath}`);
    process.exit(1);
  }

  const outFilename = path.basename(getObfuscatedAudioPathForDay(args.date, args.category));
  const outPath = path.join(outDir, outFilename);

  execFileSync("ffmpeg", [
    "-y",
    "-ss",
    String(args.start),
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
  console.log(`[üretildi] ${args.date} / ${args.category} -> public/audio-secure/${outFilename}`);

  const overrides = JSON.parse(readFileSync(overridesPath, "utf8")) as Record<
    string,
    Record<string, { title: string; artist: string; spotifyTrackId: string }>
  >;
  overrides[args.date] = {
    ...overrides[args.date],
    [args.category]: { title: args.title, artist: args.artist, spotifyTrackId: args.spotify },
  };
  writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`);
  console.log(`[güncellendi] src/data/songOverrides.json (${args.date} / ${args.category})`);
}

main();

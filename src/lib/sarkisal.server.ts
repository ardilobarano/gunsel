import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSongsForCategory, MAX_ATTEMPTS } from "@/lib/sarkisal";
import { getDailyIndex } from "@/lib/dailySelection.server";
import { SONG_PLAYBACK } from "@/data/songPlayback.server";
import overridesData from "@/data/songOverrides.json";

if (!process.env.AUDIO_OBFUSCATION_SECRET) throw new Error("AUDIO_OBFUSCATION_SECRET tanımlı değil.");
const AUDIO_SECRET: string = process.env.AUDIO_OBFUSCATION_SECRET;

if (!process.env.GUESS_TOKEN_SECRET) throw new Error("GUESS_TOKEN_SECRET tanımlı değil.");
const TOKEN_SECRET: string = process.env.GUESS_TOKEN_SECRET;

export interface DailyChallenge {
  title: string;
  artist: string;
  spotifyTrackId: string;
  audioUrl: string;
}

interface SongOverride {
  title: string;
  artist: string;
  spotifyTrackId: string;
}

/** Belirli tarih+kategori için elle zorlanan şarkı — src/data/songOverrides.json'a
 * `{ "2026-08-05": { "pop": { "title": "...", "artist": "...", "spotifyTrackId": "..." } } }`
 * şeklinde ekleyerek o günü otomatik seçimin yerine geçirebilirsin (bkz.
 * scripts/prepare-sarkisal-audio.ts, bu dosyayı otomatik günceller). Belirtilmeyen
 * her gün/kategori otomatik (SONG_PLAYBACK'teki 12 şarkı arasından) seçilmeye devam eder. */
const overrides = overridesData as Record<string, Record<string, SongOverride>>;

function obfuscate(value: string): string {
  return createHmac("sha256", AUDIO_SECRET).update(value).digest("hex").slice(0, 20);
}

/** Elle yüklenen günlük şarkılar için: obfuscated dosya adı tarih+kategoriden
 * türetilir (bkz. scripts/prepare-sarkisal-audio.ts — aynı formülle klibi oraya yazar). */
export function getObfuscatedAudioPathForDay(dateKey: string, categoryId: string): string {
  return `/audio-secure/${obfuscate(`${dateKey}:${categoryId}`)}.m4a`;
}

/** Otomatik seçim yedek havuzundaki (SONG_PLAYBACK) şarkılar için: obfuscated
 * dosya adı songId'den türetilir — bu şarkılar her gün aynı dosyayı kullanır. */
function getObfuscatedAudioPathForSong(songId: string): string {
  return `/audio-secure/${obfuscate(songId)}.m4a`;
}

/** Tarih + kategoriye göre günün bulmacası (sunucu tarafı, gerçek cevap) — önce elle
 * override'a bakılır, yoksa songs.json'daki geniş arama kataloğu değil, sadece
 * SONG_PLAYBACK'te ses kaynağı atanmış şarkılar arasından deterministik seçilir. */
export function getDailyChallenge(dateKey: string, categoryId: string): DailyChallenge | undefined {
  const override = overrides[dateKey]?.[categoryId];
  if (override) {
    return { ...override, audioUrl: getObfuscatedAudioPathForDay(dateKey, categoryId) };
  }

  // Seçim indeksi sunucu sırrıyla hesaplanıyor — songs.json sözlük/kategori filtresi
  // için tarayıcıya gittiğinden, eski `hashString(...) % n` deseni otomatik seçilen
  // günlerin cevabını client'tan hesaplanabilir kılıyordu (bkz. dailySelection.server.ts).
  const pool = getSongsForCategory(categoryId).filter((song) => SONG_PLAYBACK[song.id]);
  if (pool.length === 0) return undefined;
  const song = pool[getDailyIndex(`sarkisal-${dateKey}-${categoryId}`, pool.length)];
  const playback = SONG_PLAYBACK[song.id];
  return {
    title: song.title,
    artist: song.artist,
    spotifyTrackId: playback.spotifyTrackId,
    audioUrl: getObfuscatedAudioPathForSong(song.id),
  };
}

/** Host'un yerel TZ ayarından bağımsız, sabit UTC+3 (İstanbul, DST yok) "bugün" anahtarı. */
export function getServerTodayKey(): string {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface AttemptsPayload {
  date: string;
  categoryId: string;
  attempts: number;
}

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

export function signAttemptsToken(payload: AttemptsPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Token'ı doğrular ve beklenen date/categoryId ile eşleşiyorsa attempts sayısını döner. Geçersizse null. */
export function verifyAttemptsToken(
  token: string,
  expected: { date: string; categoryId: string }
): number | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: AttemptsPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.date !== expected.date || payload.categoryId !== expected.categoryId) return null;
  if (typeof payload.attempts !== "number" || payload.attempts < 0 || payload.attempts >= MAX_ATTEMPTS) {
    return null;
  }
  return payload.attempts;
}

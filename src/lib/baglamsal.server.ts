import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { GROUP_SIZE, MAX_MISTAKES, type SolvedGroup } from "@/lib/baglamsal";
import { getDailyIndex } from "@/lib/dailySelection.server";
import { turluIndeks } from "@/lib/havuzBuyumesi";
import puzzlesData from "@/data/baglamsalPuzzles.json";

if (!process.env.GUESS_TOKEN_SECRET) throw new Error("GUESS_TOKEN_SECRET tanımlı değil.");
const TOKEN_SECRET: string = process.env.GUESS_TOKEN_SECRET;

interface Puzzle {
  id: string;
  groups: { name: string; level: number; words: string[] }[];
}

const puzzles = puzzlesData as Puzzle[];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Havuz 26'dan 62'ye çıkarıldı ve seçim turlu gezinmeye geçti.
 *
 * Bu tarihten ÖNCESİ eski seçimde bırakıldı (ilk 26 bulmaca + eski indeks):
 * `% n`'in tabanı değiştiği için havuzu büyütmek geçmiş günlerin bulmacasını da
 * değiştirirdi — arşivden tekrar oynayan biri o gün oynadığından başkasını
 * görürdü ve o an devam eden oyunda ızgara altından değişirdi.
 *
 * Bu tarihten SONRA turlu gezinme: her bulmaca, diğer 61'i çıkmadan tekrar
 * etmiyor. Eski desende (bağımsız günlük hash) 62'lik havuzda bile ilk tekrar
 * bir ayı bulmadan geliyordu.
 *
 * Turlu gezinmede HMAC'li `getDailyIndex` kullanılmıyor; gerek de yok: gizlenen
 * şey hangi bulmacanın seçildiği değil, hangi kelimenin hangi gruba ait olduğu —
 * o bilgi zaten client'a hiç gitmiyor (bkz. getShuffledWords).
 */
const BUYUME_TARIHI = "2026-08-09";
const ESKI_HAVUZ_BOYUTU = 26;

export function getDailyPuzzle(dateKey: string): Puzzle {
  if (dateKey < BUYUME_TARIHI) {
    return puzzles[getDailyIndex(`baglamsal-${dateKey}`, ESKI_HAVUZ_BOYUTU)];
  }
  return puzzles[
    turluIndeks(dateKey, puzzles.length, "baglamsal", BUYUME_TARIHI)
  ];
}

/** 16 kelime, güne göre sabit karışık sırada — herkes aynı ızgarayı görüyor.
 *  GRUP BİLGİSİ GİTMİYOR: hangi kelimenin hangi gruba ait olduğu sunucuda kalıyor,
 *  yoksa bulmaca tarayıcıdan tek bakışta çözülürdü. */
export function getShuffledWords(dateKey: string): string[] {
  const puzzle = getDailyPuzzle(dateKey);
  const words = puzzle.groups.flatMap((g) => g.words);
  const rand = mulberry32(hashString(`${dateKey}-baglamsal`));
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
}

/** Gönderilen 4 kelime bir grupla birebir eşleşiyor mu? Eşleşiyorsa grup indeksi. */
export function matchGroup(dateKey: string, secilen: string[]): number | null {
  const puzzle = getDailyPuzzle(dateKey);
  const set = new Set(secilen);
  if (set.size !== GROUP_SIZE) return null;
  const index = puzzle.groups.findIndex((g) => g.words.every((w) => set.has(w)));
  return index === -1 ? null : index;
}

/** "Bir tane eksik" ipucu: seçilen 4'ün 3'ü tek bir gruba aitse true. */
export function isOneAway(dateKey: string, secilen: string[]): boolean {
  const puzzle = getDailyPuzzle(dateKey);
  const set = new Set(secilen);
  return puzzle.groups.some((g) => g.words.filter((w) => set.has(w)).length === GROUP_SIZE - 1);
}

export function getGroup(dateKey: string, index: number): SolvedGroup {
  const g = getDailyPuzzle(dateKey).groups[index];
  return { name: g.name, level: g.level, words: g.words };
}

export function getAllGroups(dateKey: string): SolvedGroup[] {
  return getDailyPuzzle(dateKey).groups.map((g) => ({ name: g.name, level: g.level, words: g.words }));
}

export function getServerTodayKey(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

interface StatePayload {
  date: string;
  /** Çözülmüş grup indeksleri. */
  solved: number[];
  mistakes: number;
}

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

export function signStateToken(payload: StatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyStateToken(token: string, expectedDate: string): StatePayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.date !== expectedDate) return null;
  if (!Array.isArray(payload.solved) || payload.solved.some((i) => !Number.isInteger(i) || i < 0 || i > 3)) {
    return null;
  }
  if (typeof payload.mistakes !== "number" || payload.mistakes < 0 || payload.mistakes > MAX_MISTAKES) {
    return null;
  }
  return payload;
}

import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CustomMode } from "@/lib/kelimesel";

if (!process.env.GUESS_TOKEN_SECRET) throw new Error("GUESS_TOKEN_SECRET tanımlı değil.");
const TOKEN_SECRET: string = process.env.GUESS_TOKEN_SECRET;

// 0/1/I/O gibi karışabilecek karakterler çıkarıldı — 32 karakter (2^5), byte % 32
// hiç modulo yanlılığı yaratmıyor (256 tam bölünüyor).
const SHARE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SHARE_CODE_LENGTH = 5;

function generateShareCode(): string {
  const bytes = randomBytes(SHARE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length];
  }
  return code;
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

export interface CreatePuzzleInput {
  creatorId: string;
  /** trUpper'lanmış, MIN_LENGTH-MAX_LENGTH arası, sırayla çözülecek kelimeler. */
  words: string[];
  maxGuesses: number;
  timeLimitSeconds: number | null;
  dictionaryEnabled: boolean;
  mode: CustomMode;
}

/** Bulmacayı DB'ye yazar, shareCode çakışması (son derece düşük ihtimal) olursa yeniden dener. */
export async function createCustomPuzzle(input: CreatePuzzleInput): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shareCode = generateShareCode();
    try {
      await prisma.customPuzzle.create({
        data: {
          shareCode,
          creatorId: input.creatorId,
          maxGuesses: input.maxGuesses,
          timeLimitSeconds: input.timeLimitSeconds,
          dictionaryEnabled: input.dictionaryEnabled,
          mode: input.mode,
          words: { create: input.words.map((word, orderIndex) => ({ orderIndex, word })) },
        },
      });
      return shareCode;
    } catch (err) {
      if (isUniqueConstraintError(err)) continue;
      throw err;
    }
  }
  throw new Error("shareCode üretilemedi (çok fazla çakışma).");
}

export interface PuzzleWithWords {
  shareCode: string;
  maxGuesses: number;
  timeLimitSeconds: number | null;
  dictionaryEnabled: boolean;
  mode: CustomMode;
  /** orderIndex sırasına göre — kelimenin kendisi asla route handler dışına (client'a) gitmiyor. */
  words: string[];
}

export async function getPuzzleByCode(shareCode: string): Promise<PuzzleWithWords | null> {
  const puzzle = await prisma.customPuzzle.findUnique({
    where: { shareCode },
    include: { words: { orderBy: { orderIndex: "asc" } } },
  });
  if (!puzzle) return null;

  return {
    shareCode: puzzle.shareCode,
    maxGuesses: puzzle.maxGuesses,
    timeLimitSeconds: puzzle.timeLimitSeconds,
    dictionaryEnabled: puzzle.dictionaryEnabled,
    mode: puzzle.mode as CustomMode,
    words: puzzle.words.map((w) => w.word),
  };
}

interface AttemptsPayload {
  shareCode: string;
  wordIndex: number;
  attempts: number;
  /** Epoch saniye — bulmacanın ilk kelimesine başlarken damgalanır, tüm seri boyunca
   * sabit kalır (Time Limit ayarı tüm bulmaca için, kelime başına değil). */
  startedAt: number;
}

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

export function signCustomAttemptsToken(payload: AttemptsPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Token'ı doğrular ve şekli/imzası geçerliyse payload'ı döner. maxGuesses/kelime sayısı
 * gibi bulmacaya özgü sınırlar burada değil, puzzle'ı zaten DB'den çeken route'ta kontrol edilir. */
export function verifyCustomAttemptsToken(token: string, expected: { shareCode: string }): AttemptsPayload | null {
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

  if (payload.shareCode !== expected.shareCode) return null;
  if (typeof payload.wordIndex !== "number" || payload.wordIndex < 0) return null;
  if (typeof payload.attempts !== "number" || payload.attempts < 0) return null;
  if (typeof payload.startedAt !== "number") return null;

  return payload;
}

import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { auth } from "@/../auth";
import {
  CUSTOM_TIME_LIMIT_OPTIONS,
  isTurkishLetter,
  MAX_CUSTOM_WORDS,
  MAX_LENGTH,
  MIN_LENGTH,
  type CustomMode,
  type WordLength,
} from "@/lib/kelimesel";
import { isValidWord } from "@/lib/kelimeselDictionary.server";
import { createCustomPuzzle } from "@/lib/kelimeselOzel.server";
import { trUpper } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  words?: unknown;
  maxGuesses?: unknown;
  timeLimitSeconds?: unknown;
  dictionaryEnabled?: unknown;
  mode?: unknown;
}

function isValidTurkishWord(word: string): boolean {
  return word.length > 0 && word.split("").every(isTurkishLetter);
}

export async function POST(request: Request) {
  /* Bulmaca oluşturma sınırlı: sınırsızken tek hesap DB'yi bulmacayla doldurabilirdi. */
  const limited = await rateLimit(`ozel-olustur:${getClientKey(request)}`, 10, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Giriş yapman gerekiyor." }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (!Array.isArray(body.words) || body.words.length === 0 || body.words.length > MAX_CUSTOM_WORDS) {
    return NextResponse.json({ error: `1-${MAX_CUSTOM_WORDS} arası kelime girmelisin.` }, { status: 400 });
  }

  const words: string[] = [];
  for (const raw of body.words) {
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "Geçersiz kelime." }, { status: 400 });
    }
    const word = trUpper(raw.trim());
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH || !isValidTurkishWord(word)) {
      return NextResponse.json(
        { error: `Kelimeler ${MIN_LENGTH}-${MAX_LENGTH} harf arası, sadece Türkçe harflerden oluşmalı.` },
        { status: 400 }
      );
    }
    words.push(word);
  }

  const dictionaryEnabled = body.dictionaryEnabled !== false;
  if (dictionaryEnabled) {
    // Hedef kelime sözlükte yoksa Dictionary açıkken doğru cevap bile "geçersiz
    // kelime" olarak reddedilir, bulmaca çözülemez hale gelir — burada engelliyoruz.
    for (const word of words) {
      if (!isValidWord(word, word.length as WordLength)) {
        return NextResponse.json(
          { error: `"${word}" sözlükte yok. Dictionary'i kapatabilir ya da başka bir kelime seçebilirsin.` },
          { status: 400 }
        );
      }
    }
  }

  const maxGuesses = Number(body.maxGuesses);
  if (!Number.isInteger(maxGuesses) || maxGuesses < 1 || maxGuesses > 10) {
    return NextResponse.json({ error: "Geçersiz deneme hakkı (1-10 arası olmalı)." }, { status: 400 });
  }

  const timeLimitSeconds = body.timeLimitSeconds === undefined ? null : body.timeLimitSeconds;
  if (typeof timeLimitSeconds !== "number" && timeLimitSeconds !== null) {
    return NextResponse.json({ error: "Geçersiz süre limiti." }, { status: 400 });
  }
  if (!CUSTOM_TIME_LIMIT_OPTIONS.some((option) => option.value === timeLimitSeconds)) {
    return NextResponse.json({ error: "Geçersiz süre limiti." }, { status: 400 });
  }

  const mode: CustomMode = body.mode === "hard" ? "hard" : "normal";

  const shareCode = await createCustomPuzzle({
    creatorId: session.user.id,
    words,
    maxGuesses,
    timeLimitSeconds,
    dictionaryEnabled,
    mode,
  });

  return NextResponse.json({ shareCode });
}

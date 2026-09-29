import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { evaluateGuess, type WordLength } from "@/lib/kelimesel";
import { isValidWord } from "@/lib/kelimeselDictionary.server";
import { getPuzzleByCode, signCustomAttemptsToken, verifyCustomAttemptsToken } from "@/lib/kelimeselOzel.server";
import { trUpper } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GuessBody {
  guess?: unknown;
  attemptsToken?: unknown;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  /* Paylaşım kodu 5 karakter (32^5 ≈ 33 milyon). Sınırsız denemede kaba kuvvetle
   başkalarının bulmacaları bulunabilirdi; sınır bunu pratikte imkânsız kılıyor. */
  const limited = await rateLimit(`ozel-guess:${getClientKey(request)}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { code } = await params;

  let body: GuessBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  if (!body.attemptsToken || typeof body.attemptsToken !== "string") {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 400 });
  }

  const puzzle = await getPuzzleByCode(code);
  if (!puzzle) {
    return NextResponse.json({ error: "Bulmaca bulunamadı." }, { status: 404 });
  }

  const payload = verifyCustomAttemptsToken(body.attemptsToken, { shareCode: code });
  if (!payload || payload.wordIndex >= puzzle.words.length || payload.attempts >= puzzle.maxGuesses) {
    return NextResponse.json({ error: "Geçersiz veya süresi geçmiş token." }, { status: 400 });
  }

  const answer = puzzle.words[payload.wordIndex];

  // Time Limit tüm bulmaca boyunca tek bir saat (kelime başına değil) — süre
  // dolduysa daha tahmine bakmadan bulmaca bitiyor.
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (puzzle.timeLimitSeconds !== null && nowSeconds - payload.startedAt > puzzle.timeLimitSeconds) {
    return NextResponse.json({
      valid: true,
      timeUp: true,
      status: "LOST",
      revealedWords: puzzle.words.slice(payload.wordIndex),
    });
  }

  if (typeof body.guess !== "string" || body.guess.length !== answer.length) {
    return NextResponse.json({ error: "Geçersiz tahmin." }, { status: 400 });
  }
  const guess = trUpper(body.guess);

  if (puzzle.dictionaryEnabled && !isValidWord(guess, guess.length as WordLength)) {
    return NextResponse.json({ valid: false });
  }

  const evaluation = evaluateGuess(guess, answer);
  const won = guess === answer;
  const nextAttempts = payload.attempts + 1;

  if (won) {
    const nextWordIndex = payload.wordIndex + 1;
    if (nextWordIndex >= puzzle.words.length) {
      return NextResponse.json({ valid: true, evaluation, status: "WON" });
    }
    return NextResponse.json({
      valid: true,
      evaluation,
      status: "NEXT_WORD",
      wordIndex: nextWordIndex,
      wordLength: puzzle.words[nextWordIndex].length,
      attemptsToken: signCustomAttemptsToken({
        shareCode: code,
        wordIndex: nextWordIndex,
        attempts: 0,
        startedAt: payload.startedAt,
      }),
    });
  }

  if (nextAttempts >= puzzle.maxGuesses) {
    const nextWordIndex = payload.wordIndex + 1;
    const isLastWord = nextWordIndex >= puzzle.words.length;

    // Son kelimede denemeler bitince tüm bulmaca sona erer. Ama ARADAKİ bir kelimede
    // denemeler biterse tüm bulmacayı bitirmiyoruz — sadece bu kelimenin cevabını
    // açığa çıkarıp bir sonraki kelimeye geçiyoruz (WORD_LOST, LOST'tan farklı).
    if (isLastWord) {
      return NextResponse.json({
        valid: true,
        evaluation,
        status: "LOST",
        revealedWords: [answer],
      });
    }

    return NextResponse.json({
      valid: true,
      evaluation,
      status: "WORD_LOST",
      revealedWord: answer,
      wordIndex: nextWordIndex,
      wordLength: puzzle.words[nextWordIndex].length,
      attemptsToken: signCustomAttemptsToken({
        shareCode: code,
        wordIndex: nextWordIndex,
        attempts: 0,
        startedAt: payload.startedAt,
      }),
    });
  }

  return NextResponse.json({
    valid: true,
    evaluation,
    status: "PLAYING",
    attemptsToken: signCustomAttemptsToken({
      shareCode: code,
      wordIndex: payload.wordIndex,
      attempts: nextAttempts,
      startedAt: payload.startedAt,
    }),
  });
}

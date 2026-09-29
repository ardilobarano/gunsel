import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { getPuzzleByCode, signCustomAttemptsToken } from "@/lib/kelimeselOzel.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  /* Paylaşım kodu 5 karakter (32^5 ≈ 33 milyon). Sınırsız denemede kaba kuvvetle
   başkalarının bulmacaları bulunabilirdi; sınır bunu pratikte imkânsız kılıyor. */
  const limited = await rateLimit(`ozel-challenge:${getClientKey(request)}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const { code } = await params;
  const puzzle = await getPuzzleByCode(code);
  if (!puzzle) {
    return NextResponse.json({ error: "Bulmaca bulunamadı." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);

  const wordIndexParam = Number(searchParams.get("wordIndex"));
  const wordIndex =
    Number.isInteger(wordIndexParam) && wordIndexParam >= 0 && wordIndexParam < puzzle.words.length
      ? wordIndexParam
      : 0;

  /* İstemcinin bildirdiği ilerleme ARTIK KABUL EDİLMİYOR — günlük oyunlarda
     kapatılan açığın aynısı burada da vardı ve iki ayrı yoldan sömürülebiliyordu:

     1) attempts=maxGuesses-1 ile token alıp tek tahmin göndermek, sunucuya bunu
        SON deneme saydırıp kelimeyi açıklatıyordu.
     2) startedAt olarak çok eski bir zaman göndermek, /guess'teki "süre doldu"
        dalını anında tetikliyordu — o dal KALAN TÜM KELİMELERİ döndürüyor, yani
        tek istekte bulmacanın tamamı alınabiliyordu.

     Devam etme artık sunucunun imzaladığı attemptsToken'ın saklanıp yeniden
     kullanılmasıyla oluyor (bkz. useKelimeselOzel). Token HMAC'li, uydurulamaz. */
  const attempts = 0;
  const startedAt = Math.floor(Date.now() / 1000);

  return NextResponse.json({
    shareCode: puzzle.shareCode,
    wordIndex,
    wordLength: puzzle.words[wordIndex].length,
    wordCount: puzzle.words.length,
    maxGuesses: puzzle.maxGuesses,
    timeLimitSeconds: puzzle.timeLimitSeconds,
    dictionaryEnabled: puzzle.dictionaryEnabled,
    mode: puzzle.mode,
    startedAt,
    attemptsToken: signCustomAttemptsToken({ shareCode: puzzle.shareCode, wordIndex, attempts, startedAt }),
  });
}

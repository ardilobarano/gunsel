import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { recordDailyResult } from "@/lib/dailyResult.server";
import { gecerliKategori, getHaritasalGameId, heatIndexFor, MAX_ATTEMPTS } from "@/lib/haritasal";
import {
  bearing,
  distanceKm,
  getBolgeById,
  getDailyBolge,
  getServerTodayKey,
  signAttemptsToken,
  verifyAttemptsToken,
} from "@/lib/haritasal.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RL_LIMIT = 120;
const RL_WINDOW_MS = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const limited = await rateLimit(`haritasal-guess:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    date?: string;
    kategori?: string;
    countryId?: string | null;
    attemptsToken?: string;
  } | null;
  const date = body?.date ?? "";
  const kategoriId = body?.kategori ?? "";
  const attemptsToken = body?.attemptsToken ?? "";

  if (!DATE_RE.test(date) || date > getServerTodayKey()) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }
  if (!gecerliKategori(kategoriId)) {
    return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
  }
  if (!isWithinArchiveWindow(date, getServerTodayKey())) {
    return NextResponse.json({ error: "Bu tarih arşiv aralığının dışında." }, { status: 400 });
  }
  const erisim = await guardArchiveAccess(date, getServerTodayKey());
  if (!erisim.ok) {
    return NextResponse.json({ error: erisim.error }, { status: erisim.status });
  }

  const attempts = verifyAttemptsToken(attemptsToken, date, kategoriId);
  if (attempts === null) {
    return NextResponse.json({ error: "Geçersiz oturum." }, { status: 400 });
  }

  const answer = getDailyBolge(date, kategoriId);
  /* countryId null ise "pas geç". Butonu Haritasal'dan kaldırıldı ama yol duruyor:
     kayıtlı eski oyunlarda pas geçilmiş tahminler var. */
  const guessed = body?.countryId ? getBolgeById(kategoriId, body.countryId) : undefined;
  if (body?.countryId && !guessed) {
    return NextResponse.json({ error: "Bilinmeyen bölge." }, { status: 400 });
  }

  const correct = !!guessed && guessed.id === answer.id;
  const nextAttempts = attempts + 1;
  const reveal = correct || nextAttempts >= MAX_ATTEMPTS;

  const km = guessed ? distanceKm(guessed, answer) : 0;
  const entry = guessed
    ? {
        label: guessed.label,
        heat: correct ? -1 : heatIndexFor(km, kategoriId),
        bearing: correct ? null : bearing(guessed, answer),
        correct,
      }
    : { label: "Pas geçildi", heat: -1, bearing: null, correct: false };

  if (reveal) {
    await recordDailyResult({
      gameId: getHaritasalGameId(kategoriId),
      dateKey: date,
      status: correct ? "WON" : "LOST",
      guessCount: correct ? nextAttempts : null,
    });
    return NextResponse.json({
      entry,
      answer: { label: answer.label, flag: answer.flag, plaka: answer.plaka },
    });
  }

  return NextResponse.json({
    entry,
    attemptsToken: signAttemptsToken({ date, kategoriId, attempts: nextAttempts }),
  });
}

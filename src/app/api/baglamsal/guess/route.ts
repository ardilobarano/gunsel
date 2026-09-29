import { NextResponse } from "next/server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { guardArchiveAccess, isWithinArchiveWindow } from "@/lib/arsiv.server";
import { recordDailyResult } from "@/lib/dailyResult.server";
import { GAME_ID, GROUP_COUNT, GROUP_SIZE, MAX_MISTAKES } from "@/lib/baglamsal";
import {
  getAllGroups,
  getGroup,
  getServerTodayKey,
  isOneAway,
  matchGroup,
  signStateToken,
  verifyStateToken,
} from "@/lib/baglamsal.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RL_LIMIT = 120;
const RL_WINDOW_MS = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const limited = await rateLimit(`baglamsal-guess:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek. Biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    date?: string;
    words?: unknown;
    stateToken?: string;
  } | null;

  const date = body?.date ?? "";
  if (!DATE_RE.test(date) || date > getServerTodayKey()) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }
  if (!isWithinArchiveWindow(date, getServerTodayKey())) {
    return NextResponse.json({ error: "Bu tarih arşiv aralığının dışında." }, { status: 400 });
  }
  const erisim = await guardArchiveAccess(date, getServerTodayKey());
  if (!erisim.ok) {
    return NextResponse.json({ error: erisim.error }, { status: erisim.status });
  }

  const state = verifyStateToken(body?.stateToken ?? "", date);
  if (!state) return NextResponse.json({ error: "Geçersiz oturum." }, { status: 400 });

  const secilen = Array.isArray(body?.words) ? body.words.filter((w): w is string => typeof w === "string") : [];
  if (secilen.length !== GROUP_SIZE) {
    return NextResponse.json({ error: "Dört kelime seçilmeli." }, { status: 400 });
  }

  const eslesen = matchGroup(date, secilen);
  const zatenCozulmus = eslesen !== null && state.solved.includes(eslesen);

  // Doğru grup
  if (eslesen !== null && !zatenCozulmus) {
    const solved = [...state.solved, eslesen];
    const bitti = solved.length === GROUP_COUNT;

    if (bitti) {
      await recordDailyResult({
        gameId: GAME_ID,
        dateKey: date,
        status: "WON",
        guessCount: state.mistakes,
      });
    }

    return NextResponse.json({
      correct: true,
      group: getGroup(date, eslesen),
      solvedCount: solved.length,
      mistakes: state.mistakes,
      finished: bitti,
      ...(bitti ? { allGroups: getAllGroups(date) } : {}),
      stateToken: signStateToken({ date, solved, mistakes: state.mistakes }),
    });
  }

  // Yanlış
  const mistakes = state.mistakes + 1;
  const kaybetti = mistakes >= MAX_MISTAKES;

  if (kaybetti) {
    await recordDailyResult({ gameId: GAME_ID, dateKey: date, status: "LOST", guessCount: null });
  }

  return NextResponse.json({
    correct: false,
    // "Bir tane eksik" ipucu sadece oyun sürerken anlamlı.
    oneAway: !kaybetti && isOneAway(date, secilen),
    solvedCount: state.solved.length,
    mistakes,
    finished: kaybetti,
    ...(kaybetti ? { allGroups: getAllGroups(date) } : {}),
    stateToken: signStateToken({ date, solved: state.solved, mistakes }),
  });
}

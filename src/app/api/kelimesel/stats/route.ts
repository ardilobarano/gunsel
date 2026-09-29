import { NextResponse } from "next/server";
import { MAX_LENGTH, MIN_LENGTH, type WordLength } from "@/lib/kelimesel";
import { getDailyResultStats, getServerTodayKey } from "@/lib/kelimesel.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const lengthParam = Number(searchParams.get("length"));

  if (!DATE_RE.test(date) || date > getServerTodayKey()) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }
  if (!Number.isInteger(lengthParam) || lengthParam < MIN_LENGTH || lengthParam > MAX_LENGTH) {
    return NextResponse.json({ error: "Geçersiz uzunluk." }, { status: 400 });
  }

  const stats = await getDailyResultStats(date, lengthParam as WordLength);
  return NextResponse.json(stats);
}

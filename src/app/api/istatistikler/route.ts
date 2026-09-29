import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserResults, saveResultPayload } from "@/lib/dailyResult.server";
import { getClientKey, rateLimit } from "@/lib/rateLimit";
import { getServerTodayKey } from "@/lib/arsiv.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Giriş yapmış oyuncunun sunucudaki geçmişi. Girişsizse boş döner (istatistikler
 *  o zaman eskisi gibi localStorage'dan hesaplanır). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ signedIn: false, results: [] });

  return NextResponse.json({ signedIn: true, results: await getUserResults(session.user.id) });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Tek istekte kabul edilen en fazla kayıt — bir oyuncunun makul geçmişinin çok üstü. */
const MAX_KAYIT = 2000;
/** Senkron oturumda bir kez ("results" ile) + oyun bittikçe birer kez ("payload" ile,
 *  bkz. storage.ts syncFinishedGamePayload) çağrılıyor — bir oturumda tüm oyunları
 *  bitiren biri ~20 istek atabilir, sınır buna göre geniş tutuluyor. */
const RL_LIMIT = 40;
const RL_WINDOW_MS = 10 * 60_000;
/** Tek bir "payload" gövdesinin en fazla boyutu — tahmin/kare geçmişi büyük olsa da makul sınırda. */
const MAX_PAYLOAD_BYTES = 20_000;
/** Sitenin yayına girdiği günden öncesi kabul edilmiyor. */
const EN_ESKI = "2026-07-01";

/** Kabul edilen oyun kimlikleri. Serbest metin bırakılsaydı, uydurma gameId'lerle
 *  hesabın geçmişi çöple doldurulabilirdi. */
function gecerliGameId(id: string): boolean {
  if (id === "harfBahcesi" || id === "karesel") return true;
  if (/^kelimesel-[3-8]$/.test(id)) return true;
  if (/^sarkisal-(tumu|pop|rap)$/.test(id)) return true;
  if (/^dahaAzCok-(nufus|film|dizi|spotify|fiyat|trivia)$/.test(id)) return true;
  if (id === "haritasal" || id === "baglamsal") return true;
  return false;
}

interface GelenKayit {
  gameId?: unknown;
  dateKey?: unknown;
  status?: unknown;
  guessCount?: unknown;
  /** Harf Peteği gibi sunucu tarafı olmayan oyunlarda tahmin/kare geçmişini de
   *  taşıyor — bkz. storage.ts collectLocalHistory. */
  payload?: unknown;
}

interface GelenPayload {
  gameId?: unknown;
  dateKey?: unknown;
  data?: unknown;
}

function payloadBoyutUygun(payload: unknown): boolean {
  try {
    return JSON.stringify(payload).length <= MAX_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

/**
 * localStorage'daki ESKİ geçmişi hesaba bir kereye mahsus taşır.
 *
 * Neden gerekli: sunucu tarafı kayıt bugün başlıyor. Bu olmadan, aylardır oynayan
 * biri giriş yaptığında istatistikleri sıfır görürdü.
 *
 * Neden güvenli sayılabilir: kayıtlar source="client" işaretiyle yazılıyor ve
 * SADECE o gün/oyun için sunucuda kayıt YOKSA ekleniyor — sunucunun kendi
 * belirlediği bir sonucu ezemiyor. Yani kimse kaybettiği bir günü kazanmışa
 * çeviremez. İleride sıralama tablosu gelirse "client" satırlar dışlanabilir.
 */
export async function POST(request: Request) {
  const limited = await rateLimit(`stats-import:${getClientKey(request)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { results?: GelenKayit[]; payload?: GelenPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const bugun = getServerTodayKey();
  const gelen = Array.isArray(body.results) ? body.results.slice(0, MAX_KAYIT) : [];
  const temiz = gelen.flatMap((r) => {
    if (typeof r.gameId !== "string" || !gecerliGameId(r.gameId)) return [];
    if (typeof r.dateKey !== "string" || !DATE_RE.test(r.dateKey)) return [];
    /* GELECEK ve çok eski tarihler reddediliyor: format kontrolü tek başına
       yetmiyordu, "2099-01-01 kazandım" gönderilip geçmiş çöple doldurulabiliyordu. */
    if (r.dateKey > bugun || r.dateKey < EN_ESKI) return [];
    if (r.status !== "WON" && r.status !== "LOST") return [];
    const gc = typeof r.guessCount === "number" && Number.isInteger(r.guessCount) && r.guessCount > 0 && r.guessCount <= 50
      ? r.guessCount
      : null;
    const payload: Prisma.InputJsonValue | undefined =
      r.payload !== undefined && payloadBoyutUygun(r.payload) ? (r.payload as Prisma.InputJsonValue) : undefined;
    return [{ userId, gameId: r.gameId, dateKey: r.dateKey, status: r.status, guessCount: gc, source: "client", payload }];
  });

  let imported = 0;
  if (temiz.length > 0) {
    /* skipDuplicates: (userId, gameId, dateKey) benzersiz. Sunucunun yazdığı satır
       varsa dokunulmuyor — içe aktarma asla üzerine yazmıyor. */
    const sonuc = await prisma.dailyResult.createMany({ data: temiz, skipDuplicates: true });
    imported = sonuc.count;
  }

  // Bitmiş bir oyunun tahmin/kare geçmişini o günün satırına ekliyor — bkz.
  // storage.ts syncFinishedGamePayload. Satır zaten /guess'in içinde açılmış oluyor,
  // burada sadece üstüne detay yazılıyor (bkz. saveResultPayload).
  let payloadSaved = false;
  const p = body.payload;
  if (
    p &&
    typeof p.gameId === "string" &&
    gecerliGameId(p.gameId) &&
    typeof p.dateKey === "string" &&
    DATE_RE.test(p.dateKey) &&
    p.dateKey <= bugun &&
    p.dateKey >= EN_ESKI &&
    p.data !== undefined &&
    payloadBoyutUygun(p.data)
  ) {
    await saveResultPayload({ userId, gameId: p.gameId, dateKey: p.dateKey, payload: p.data });
    payloadSaved = true;
  }

  return NextResponse.json({ imported, payloadSaved });
}

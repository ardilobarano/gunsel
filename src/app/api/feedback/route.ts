import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getClientKey, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 2000;
const MAX_CONTACT = 200;
const MAX_PAGE = 200;
const MAX_USER_AGENT = 400;

/** Geri bildirim seyrek gönderilen bir şey — spam'i sınırlamak için dar tutuldu. */
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

interface Body {
  message?: string;
  contact?: string;
  page?: string;
}

export async function POST(request: Request) {
  const limited = await rateLimit(`feedback:${getClientKey(request)}`, LIMIT, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Çok fazla gönderim yaptın. Biraz sonra tekrar dene." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (message.length === 0) {
    return NextResponse.json({ error: "Mesaj boş olamaz." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "Mesaj çok uzun." }, { status: 400 });
  }

  // Giriş ZORUNLU değil (oyunlar girişsiz oynanıyor); giriş varsa hesap da bağlanıyor.
  const session = await auth();

  await prisma.feedback.create({
    data: {
      message,
      contact: (body.contact ?? "").trim().slice(0, MAX_CONTACT) || null,
      userId: session?.user?.id ?? null,
      page: (body.page ?? "").slice(0, MAX_PAGE) || null,
      userAgent: (request.headers.get("user-agent") ?? "").slice(0, MAX_USER_AGENT) || null,
    },
  });

  return NextResponse.json({ ok: true });
}

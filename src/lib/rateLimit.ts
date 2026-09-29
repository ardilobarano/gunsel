import "server-only";

/**
 * Hız sınırlayıcı — özellikle TMDB/Spotify'a giden arama proxy'lerini korumak
 * için. O uçlar BİZİM API anahtarlarımızı kullanıyor; sınırsız bırakılırsa
 * üçüncü biri bunları bedava arama API'si gibi kullanıp kotamızı tüketebilir.
 *
 * İKİ KATMAN:
 *  1. Upstash Redis (env tanımlıysa) — GERÇEK sınır. Sayaç tüm sunucu
 *     örneklerinde ORTAK olduğu için Vercel'de de çalışır.
 *  2. Süreç belleği (env yoksa ya da Redis erişilemezse) — yedek.
 *
 * NEDEN REDIS GEREKTİ: sayaç yalnızca süreç belleğinde tutulurken Vercel
 * istekleri onlarca örneğe dağıttığı için koruma fiilen YOKTU. Canlıda 200
 * paralel istekle ölçüldü: BEŞ ayrı uçta sıfır istek engellendi. Bellek yedeği
 * yine de duruyor — Redis'e ulaşılamadığında sıfır korumadan iyidir.
 *
 * KURULUM: Upstash'te ücretsiz bir Redis veritabanı açıp iki değişkeni hem
 * `.env.local`'a hem Vercel'in env paneline ekle:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * Tanımlı değilse site çalışmaya devam eder, sadece sınır örnek başına kalır.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisVar = Boolean(REDIS_URL && REDIS_TOKEN);

export interface RateLimitResult {
  ok: boolean;
  /** Sınır aşıldıysa istemciye Retry-After olarak verilecek saniye. */
  retryAfterSeconds: number;
}

// --- Yedek: süreç belleği ---

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

/** Bellek sızıntısını önlemek için süresi dolmuş kayıtları ara sıra temizle. */
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function bellekSiniri(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

// --- Asıl: Upstash Redis ---

/**
 * Sabit pencere sayacı, TEK gidiş-dönüşte: INCR + (ilk istekse) EXPIRE.
 *
 * `EXPIRE ... NX` sayesinde süre yalnızca anahtarın ömrü yokken kuruluyor —
 * her istekte yeniden kurulsaydı pencere sürekli ileri kayar ve sınır hiç
 * dolmazdı.
 */
async function redisSiniri(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const saniye = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(saniye), "NX"],
      ]),
      /* Redis yavaşsa istek beklemesin: sınırlayıcı, oyunun kendisini
         yavaşlatmamalı. Zaman aşımında bellek yedeğine düşülüyor. */
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const cevap = (await res.json()) as { result?: number; error?: string }[];
    const sayi = cevap?.[0]?.result;
    if (typeof sayi !== "number") return null;

    if (sayi > limit) return { ok: false, retryAfterSeconds: saniye };
    return { ok: true, retryAfterSeconds: 0 };
  } catch {
    return null;
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (redisVar) {
    const sonuc = await redisSiniri(key, limit, windowMs);
    /* null = Redis'e ulaşılamadı. Sıkı davranıp isteği reddetmek, Redis kesintisinde
       TÜM siteyi durdururdu; bellek yedeği bozuk parayla da olsa koruma sağlıyor. */
    if (sonuc) return sonuc;
  }
  return bellekSiniri(key, limit, windowMs);
}

/** İstemci IP'si — Vercel proxy arkasında olduğumuz için x-forwarded-for'un ilk değeri. */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "bilinmeyen";
}

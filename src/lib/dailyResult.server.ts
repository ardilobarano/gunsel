import "server-only";
import { auth } from "@/../auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Bir oyunun günlük sonucunu kaydeder.
 *
 * Oyunun sonucu SUNUCUDA belirlendiği an çağrılır (Kelimesel/Şarkısal/Karesel/
 * Daha Az-Çok'un /guess route'ları) — ayrı bir "sonucumu kaydet" ucu olsaydı
 * istemciden uydurulabilirdi, o yüzden böyle bir uç YOK.
 *
 * İki satır birden yazılır:
 * - userId NULL: herkesin dahil olduğu anonim toplam (Kelimesel'in dağılım grafiği).
 * - userId dolu (giriş varsa): oyuncunun kalıcı geçmişi.
 * Ayrı tutulmalarının sebebi: dağılım grafiği girişsiz oynayanları da saymalı,
 * ama kişisel geçmiş yalnızca hesaba ait olmalı.
 *
 * Kişisel satır UPSERT: aynı gün+oyun için ikinci kez yazılırsa yeni satır
 * açmıyor. Sonuç zaten değişmez (oyun bitti), ama /guess yeniden çağrılabildiği
 * için (bkz. attemptsToken) idempotent olması gerekiyor.
 */
export async function recordDailyResult(params: {
  gameId: string;
  dateKey: string;
  status: "WON" | "LOST";
  guessCount?: number | null;
  /** Sadece Harf Peteği ve içe aktarma "client" olabilir; oyun route'ları hep "server". */
  source?: "server" | "client";
}): Promise<void> {
  const { gameId, dateKey, status, guessCount = null, source = "server" } = params;

  /* Kayıt ASLA oyunu bozmamalı: burası /guess'in içinden çağrılıyor ve bir DB ya da
     oturum hatası, oyuncunun cevabını görememesine yol açardı. İstatistik kaybetmek
     oyunu kaybettirmekten iyidir, o yüzden her şey yutuluyor ve sadece loglanıyor. */
  try {
    // Anonim toplam satırı — dağılım grafiği bunu okuyor, giriş şartı yok.
    await prisma.dailyResult.create({ data: { gameId, dateKey, status, guessCount, source } });
  } catch (error) {
    console.error("[dailyResult] anonim kayıt başarısız:", error);
  }

  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return;

    await prisma.dailyResult.upsert({
      where: { userId_gameId_dateKey: { userId, gameId, dateKey } },
      create: { userId, gameId, dateKey, status, guessCount, source },
      update: { status, guessCount, source },
    });
  } catch (error) {
    console.error("[dailyResult] kişisel kayıt başarısız:", error);
  }
}

export interface KayitliSonuc {
  gameId: string;
  dateKey: string;
  status: string;
  guessCount: number | null;
  payload: unknown;
}

/** Giriş yapmış oyuncunun tüm geçmişi (eskiden yeniye). */
export async function getUserResults(userId: string): Promise<KayitliSonuc[]> {
  return prisma.dailyResult.findMany({
    where: { userId },
    select: { gameId: true, dateKey: true, status: true, guessCount: true, payload: true },
    orderBy: { dateKey: "asc" },
  });
}

/**
 * Bitmiş bir oyunun tahmin/kare geçmişini + açığa çıkan cevabı sunucuya ekler.
 *
 * recordDailyResult'tan AYRI: satır zaten /guess'in içinden (reveal anında) açılmış
 * oluyor, bu sadece o satırın üstüne detay ekliyor — ayrı bir uçtan (StatsSync'in
 * "bitince gönder" çağrısı) geldiği için updateMany kullanılıyor (satır yoksa
 * sessizce 0 satır güncellenir, throw etmez — token/zamanlama garip bir sırayla
 * gelse bile oyunu bozmaz).
 */
export async function saveResultPayload(params: {
  userId: string;
  gameId: string;
  dateKey: string;
  payload: unknown;
}): Promise<void> {
  const { userId, gameId, dateKey, payload } = params;
  try {
    await prisma.dailyResult.updateMany({
      where: { userId, gameId, dateKey },
      data: { payload: payload as Prisma.InputJsonValue },
    });
  } catch (error) {
    console.error("[dailyResult] payload kaydı başarısız:", error);
  }
}

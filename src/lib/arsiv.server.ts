import "server-only";
import { auth } from "@/../auth";

/**
 * Arşiv erişimi: BUGÜN dışındaki bir günün bulmacası ancak giriş yapmış kullanıcıya
 * verilir.
 *
 * Neden sunucuda: geçmiş günlerin cevapları bu API'lerden zaten korumasız
 * alınabiliyordu (curl ile doğrulandı). Sadece arayüzü gizlemek sahte bir kilit
 * olurdu — arşiv "girişe değer" bir şey olacaksa kapının kendisi burada olmalı.
 *
 * Bugünün bulmacası HERKESE açık kalır: günlük oyun girişsiz oynanıyor, öyle kalmalı.
 */
export async function guardArchiveAccess(
  date: string,
  todayKey: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (date === todayKey) return { ok: true };

  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      status: 401,
      error: "Geçmiş günlerin bulmacaları için giriş yapman gerekiyor.",
    };
  }
  return { ok: true };
}

/** Arşivde geriye kaç gün gidilebildiği. Bugün dahil değil. */
export const ARCHIVE_DAYS = 30;

/** Host'un yerel TZ'inden bağımsız, sabit UTC+3 (İstanbul, DST yok) "bugün". Oyun
 *  server lib'lerindeki getServerTodayKey ile aynı hesap — sayfalar oyuna özel bir
 *  server dosyası import etmek zorunda kalmasın diye burada da var. */
export function getServerTodayKey(): string {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Oyun sayfalarının `?tarih=` parametresini çözer.
 * Geçersiz, pencere dışı ya da giriş yapılmamışsa null döner — sayfa o zaman
 * normal (bugünkü) bulmacayı gösterir. Sessizce düşmesi bilinçli: kimse
 * elle URL yazarak hata ekranıyla karşılaşmasın, sadece bugünü oynasın.
 */
export async function resolveArsivTarihi(
  searchParams: Promise<{ tarih?: string }>,
  todayKey: string
): Promise<string | null> {
  const { tarih } = await searchParams;
  if (!tarih || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return null;
  if (tarih === todayKey) return null;
  if (!isWithinArchiveWindow(tarih, todayKey)) return null;

  const session = await auth();
  if (!session?.user?.id) return null;
  return tarih;
}

/** Son ARCHIVE_DAYS günün anahtarları, yeniden eskiye (bugün hariç). */
export function getArchiveDates(todayKey: string): string[] {
  const out: string[] = [];
  const base = Date.parse(`${todayKey}T00:00:00Z`);
  for (let i = 1; i <= ARCHIVE_DAYS; i++) {
    out.push(new Date(base - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return out;
}

/** İstenen tarih arşiv penceresinin içinde mi (çok eski günler açılmasın). */
export function isWithinArchiveWindow(date: string, todayKey: string): boolean {
  if (date === todayKey) return true;
  const gun = 24 * 60 * 60 * 1000;
  const fark = (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / gun;
  return Number.isFinite(fark) && fark > 0 && fark <= ARCHIVE_DAYS;
}

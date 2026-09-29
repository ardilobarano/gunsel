import "server-only";
import { createHmac } from "node:crypto";

/**
 * Günün bulmacasını havuzdan seçerken kullanılan indeks — sunucu sırrına bağlı.
 *
 * NEDEN GEREKLİ: Önceki desen `hashString(tarih) % havuzUzunluğu` idi. Bu, iki koşul
 * bir araya geldiğinde cevabı tamamen ele veriyordu:
 *   1) Havuzun kendisi tarayıcıya gidiyor olabilir — Kelimesel'de `validWords.json`
 *      sözlük kontrolü için client'a gönderiliyor ve `targetWords.json` ile BİREBİR
 *      aynı içerik ve sırada (ölçüldü).
 *   2) Kullanılan hash sıradan bir string hash'i (`h*31 + charCode`) — tahmin edilmesi
 *      dakikalar sürer, ayrıca aynı fonksiyon Harf Peteği üzerinden client'a gidiyor.
 * Sonuç: `validWords[len][hash(`${tarih}-${len}`) % n]` günün cevabını veriyordu.
 * 2026-08-05 için 6 harf uzunluğunun 6'sında da gerçek cevapla eşleştiği doğrulandı.
 *
 * HMAC'e geçince havuz tamamen bilinse bile indeks sır olmadan hesaplanamıyor.
 *
 * NOT: Bu sır DEĞİŞİRSE tüm günlerin cevapları değişir — rotasyon içerik kayması demek.
 * GUESS_TOKEN_SECRET'tan bilerek ayrı tutuldu ki token sırrı rotasyonu içeriği kaydırmasın.
 */
if (!process.env.DAILY_SELECTION_SECRET) throw new Error("DAILY_SELECTION_SECRET tanımlı değil.");
const SECRET: string = process.env.DAILY_SELECTION_SECRET;

export function getDailyIndex(key: string, modulus: number): number {
  if (modulus <= 0) return 0;
  // HMAC'in ilk 8 baytını sayıya çevir; 2^53 sınırının altında kalmak için 6 bayt kullanılıyor.
  const digest = createHmac("sha256", SECRET).update(key).digest();
  const value = Number(digest.readUIntBE(0, 6));
  return value % modulus;
}

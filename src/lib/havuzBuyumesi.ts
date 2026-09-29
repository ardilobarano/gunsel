/**
 * Havuz büyürken GEÇMİŞ günlerin içeriğini korumak için ortak araçlar.
 *
 * SORUN: günlük seçim `hash(tarih) % havuz.length`. Havuza yeni öğe eklemek
 * bölme tabanını değiştiriyor, yani sadece gelecek günleri değil GEÇMİŞ günleri
 * de kaydırıyor. İki somut zarar:
 *   1. Arşivden bir günü tekrar oynayan kişi, o gün oynadığından başka bir
 *      bulmaca görür — kaydettiği sonuç artık başka bir bulmacaya ait.
 *   2. O an devam eden oyun bozulur: Harf Peteği'nde harfler değişir ve
 *      localStorage'daki bulunmuş kelimeler yeni harflere uymaz.
 *
 * ÇÖZÜM: büyüme bir TARİHTEN İTİBAREN geçerli. O tarihten önceki günler eski
 * seçimi kullanmaya devam ediyor, yani eskiden ne çıkıyorsa yine o çıkar.
 *
 * ŞART: yeni öğeler havuzun SONUNA eklenmeli — ilk N öğe ve sıraları aynı
 * kalmalı. `scripts/dogrula-havuz-ekleme.ts` bunu ölçüyor.
 */

export interface HavuzAsamasi {
  /** Bu boyutun geçerli olmaya başladığı gün, YYYY-AA-GG (o gün dahil). */
  gecerliTarih: string;
  boyut: number;
}

/**
 * `dateKey` için hangi havuz boyutunun geçerli olduğunu döndürür.
 * Aşamalar tarihe göre ARTAN sırada verilmeli.
 *
 * Seçim desenini değiştirmeden sadece havuzu büyüten oyunlar için.
 */
export function havuzBoyutu(
  dateKey: string,
  asamalar: readonly HavuzAsamasi[],
): number {
  let boyut = asamalar[0].boyut;
  for (const asama of asamalar) {
    if (dateKey >= asama.gecerliTarih) boyut = asama.boyut;
  }
  return boyut;
}

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EPOCH_DATE = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH_DATE) / DAY_MS);
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * Havuzu her turda karıp sırayla gezer: bir öğe tekrar etmeden önce havuzdaki
 * diğerlerinin hepsi çıkar, tur değişince sıra da değişir.
 *
 * `hash(tarih) % n` deseninin yerine geçiyor. O desen her günü BAĞIMSIZ seçtiği
 * için doğum günü paradoksuna yakalanıyor: 250 bulmacalık havuzda bile ilk tekrar
 * 76. günde geliyordu (ölçüldü), yani havuzu büyütmenin faydasının çoğu boşa
 * gidiyordu. Aynı gerekçeyle Karesel ve Haritasal da bu deseni kullanıyor.
 *
 * Karışım hash tabanlı (HMAC değil): burada gizlenen bir cevap yok — Harf
 * Peteği'nin geçerli kelime listesi zaten client'ta olmak zorunda.
 */
export function turluIndeks(
  dateKey: string,
  boyut: number,
  tohumOnEki: string,
  /**
   * Tur sayacının 0'dan başladığı gün. Verilmezse takvim başlangıcı kullanılır.
   *
   * Neden gerekli: desen bir tarihten itibaren devreye girdiğinde, o tarih turun
   * ORTASINA denk gelirse ilk tur kısa kalıyor ve tur sınırında erken tekrar
   * oluyor — Harf Peteği'nde ölçüldü, ilk tekrar 250 yerine 30. günde geliyordu.
   * Devreye girme tarihi verilince ilk tur tam boy oluyor.
   */
  baslangicTarihi?: string,
): number {
  const day =
    dayNumber(dateKey) - (baslangicTarihi ? dayNumber(baslangicTarihi) : 0);
  const cycle = Math.floor(day / boyut);
  const indexInCycle = positiveMod(day, boyut);

  const order = Array.from({ length: boyut }, (_, i) => i);
  const rand = mulberry32(hashString(`${tohumOnEki}-cycle-${cycle}`));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[indexInCycle];
}

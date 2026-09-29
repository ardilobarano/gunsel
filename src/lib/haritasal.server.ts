import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MAX_ATTEMPTS } from "@/lib/haritasal";
import countriesData from "@/data/haritasalCountries.json";
import illerData from "@/data/haritasalIller.json";

if (!process.env.GUESS_TOKEN_SECRET) throw new Error("GUESS_TOKEN_SECRET tanımlı değil.");
const TOKEN_SECRET: string = process.env.GUESS_TOKEN_SECRET;

/** İki sekmenin ortak kaydı. Ülkenin bayrağı var, ilin plakası — ikisi de sonuç
 *  ekranında adın yanında gösterilen rozet, o yüzden ikisi de opsiyonel. */
export interface Bolge {
  id: string;
  label: string;
  flag?: string;
  plaka?: number;
  lat: number;
  lon: number;
  /** 0-100 kutusuna normalize edilmiş siluet; gerçek koordinat içermiyor
   *  (bkz. scripts/fetch-haritasal.ts — konum sızıntısını önlemek için). */
  path: string;
}

const countries = countriesData as Bolge[];
const iller = illerData as Bolge[];

function havuzFor(kategoriId: string): Bolge[] {
  return kategoriId === "iller" ? iller : countries;
}

/** Tahmin kutusunun listelediği adlar. Cevabı ele vermiyor: havuzun tamamı listede. */
export function getBolgeOptions(kategoriId: string): { id: string; label: string }[] {
  return havuzFor(kategoriId).map((c) => ({ id: c.id, label: c.label }));
}

export function getBolgeById(kategoriId: string, id: string): Bolge | undefined {
  return havuzFor(kategoriId).find((c) => c.id === id);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
 * Günün ülkesi.
 *
 * `hash(tarih) % havuz` deseni BİLEREK kullanılmadı — Karesel'de de aynı sebeple
 * terk edilmişti. O desen her günü bağımsız seçtiği için çakışıyor: 88 ülkelik
 * havuzda ilk tekrar 6. GÜNDE geliyor ve 88 günde ancak 56 farklı ülke çıkıyordu
 * (ölçüldü). Bunun yerine havuz her turda karılıp sırayla geziliyor: bir ülke
 * tekrar etmeden önce diğer 87'sinin hepsi çıkıyor, tur değişince sıra da değişiyor.
 *
 * Tur karışımı hash tabanlı (HMAC değil) — sızıntı riski yok, çünkü havuzun kendisi
 * (88 ülkenin adı) zaten tahmin kutusunda client'ta. Gizlenen şey hangi ülkenin
 * o günün cevabı olduğu değil, siluetin ne olduğu; o da zaten ekranda.
 */
/**
 * Havuz 88'den 173'e çıkarıldı (dünyanın tamamı). Bu tarihten ÖNCEKİ günler
 * eski 88'lik havuzu kullanmaya devam ediyor.
 *
 * Gerekçe: tur uzunluğu havuz BOYUTUNA bağlı, yani havuzu büyütmek geçmiş
 * günlerin ülkesini de değiştirirdi — arşivden bir günü tekrar oynayan kişi
 * o gün oynadığından başka bir siluet görürdü (bkz. CLAUDE.md, HAVUZ BÜYÜTME
 * KURALI). Yeni ülkeler listenin SONUNA eklendi, ilk 88'in sırası birebir
 * korundu (üretici script bunu garantiliyor ve doğrulandı).
 */
const BUYUME_TARIHI = "2026-08-13";
const ESKI_HAVUZ_BOYUTU = 88;

/**
 * İller sekmesinin ilk günü. Tur sayacı BURADAN başlıyor, EPOCH'tan değil.
 *
 * Şart, ölçülerek bulundu: gün numarası 1 Ocak'tan sayıldığında sekme turun
 * ortasından başlıyordu (2026-08-15 = 226. gün, 81'lik turun 64. sırası), yani
 * ilk 17 günden sonra tur değişip yeni bir karışıma geçiyor ve İL TEKRARI daha
 * 21. GÜNDE geliyordu (dogrula-haritasal-iller.ts bunu yakaladı). Başlangıcı
 * kaydırınca ilk tur tam 81 gün sürüyor.
 */
const ILLER_BASLANGIC = "2026-08-14";

export function getDailyBolge(dateKey: string, kategoriId: string): Bolge {
  const liste = havuzFor(kategoriId);
  const iller = kategoriId === "iller";
  /* Büyüme istisnası SADECE dünya sekmesinde: iller sekmesi sıfırdan başlıyor,
     81 il sabit, arkasında korunacak bir geçmiş yok. */
  const havuz = iller ? liste.length : dateKey < BUYUME_TARIHI ? ESKI_HAVUZ_BOYUTU : liste.length;
  /* Dünya'nın gün sayacına DOKUNULMUYOR: kaydırmak geçmiş günlerin ülkesini
     değiştirirdi (bkz. CLAUDE.md, HAVUZ BÜYÜTME KURALI). */
  const day = iller ? dayNumber(dateKey) - dayNumber(ILLER_BASLANGIC) : dayNumber(dateKey);
  const cycle = Math.floor(day / havuz);
  const indexInCycle = positiveMod(day, havuz);
  /* Tur tohumu kategoriye göre AYRI ki iki sekmenin sırası birbirinden bağımsız
     olsun. Dünya'nın tohumu BİLEREK eski haliyle bırakıldı ("haritasal-cycle-N",
     sekme sonekli değil): tohumu değiştirmek karışımı değiştirir, yani geçmiş
     günlerin ülkesini de kaydırırdı (bkz. CLAUDE.md, HAVUZ BÜYÜTME KURALI). */
  const tohum = kategoriId === "iller" ? `haritasal-iller-cycle-${cycle}` : `haritasal-cycle-${cycle}`;
  const order = seededShuffle(Array.from({ length: havuz }, (_, i) => i), hashString(tohum));
  return liste[order[indexInCycle]];
}

const DUNYA_YARICAP_KM = 6371;

const rad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(a: Bolge, b: Bolge): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * DUNYA_YARICAP_KM * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Kuzeyden saat yönünde 0-360 derece. */
export function bearing(from: Bolge, to: Bolge): number {
  const dLon = rad(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(rad(to.lat));
  const x =
    Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) -
    Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Host'un yerel TZ'inden bağımsız, sabit UTC+3 (İstanbul, DST yok). */
export function getServerTodayKey(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

interface AttemptsPayload {
  date: string;
  /** Token kategoriye BAĞLI: olmasaydı oyuncu Dünya'da aldığı token'la İller'de
   *  tahmin gönderip iki sekmenin hak sayacını tek havuz gibi kullanabilirdi. */
  kategoriId: string;
  attempts: number;
}

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

export function signAttemptsToken(payload: AttemptsPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyAttemptsToken(
  token: string,
  expectedDate: string,
  expectedKategori: string
): number | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: AttemptsPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.date !== expectedDate) return null;
  if (payload.kategoriId !== expectedKategori) return null;
  if (typeof payload.attempts !== "number" || payload.attempts < 0 || payload.attempts >= MAX_ATTEMPTS) {
    return null;
  }
  return payload.attempts;
}

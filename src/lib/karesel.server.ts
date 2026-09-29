import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MAX_ATTEMPTS } from "@/lib/karesel";
import moviesData from "@/data/kareselMovies.json";
import seriesData from "@/data/kareselSeries.json";

if (!process.env.GUESS_TOKEN_SECRET) throw new Error("GUESS_TOKEN_SECRET tanımlı değil.");
const TOKEN_SECRET: string = process.env.GUESS_TOKEN_SECRET;

export interface KareselMovie {
  tmdbId: number;
  title: string;
  originalTitle: string;
  year: string | null;
  frames: string[];
}

const movies = moviesData as KareselMovie[];
const series = seriesData as KareselMovie[];

/** Sekmenin havuzu. Film sekmesi eski havuzu birebir kullanmaya devam ediyor. */
function havuzFor(kategoriId: string): KareselMovie[] {
  return kategoriId === "dizi" ? series : movies;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Küçük, bağımlılıksız seeded PRNG (mulberry32) — dahaAzCok.server.ts'tekiyle aynı. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return function random() {
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

/** Takvim başlangıcı — gün numarası bundan sayılıyor. */
const EPOCH_DATE = Date.UTC(2024, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Negatif değerlerde de doğru çalışan modulo (epoch öncesi tarihler için). */
function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH_DATE) / DAY_MS);
}

/**
 * Günün filmi — aynı gün herkese aynı film.
 *
 * Diğer oyunlardaki `hash(tarih) % havuzUzunluğu` deseni BİLEREK kullanılmadı: o desen
 * çakışma ürettiği için 159 filmlik havuzda bile aynı film 6 gün arayla tekrarlanıyor
 * ve yıl boyunca 8 film hiç çıkmıyordu (365 gün simüle edilip ölçüldü) — havuzu
 * büyütmenin faydasını yiyordu. Bunun yerine havuz her "tur"da deterministik olarak
 * karılıp baştan sona geziliyor: bir tur içinde hiçbir film tekrarlanmıyor ve tur
 * bitmeden hiçbiri atlanmıyor.
 *
 * Ölçülen sonuç (365 gün): 159 filmin tamamı kullanılıyor (hiç çıkmayan 0), aynı film
 * en fazla 4 kez çıkıyor, tekrarlar arası en kısa mesafe 10 gün. O 10 gün tur
 * sınırında oluşuyor — yeni tur yeniden karıldığı için önceki turun sonundaki bir film
 * yeni turun başına denk gelebiliyor. Yılda bir kez yaşanan bu durum kabul edildi;
 * sınırı da düzeltmek ekstra karmaşıklığa değmedi.
 */
/**
 * Dizi sekmesinin ilk günü. Tur sayacı BURADAN başlıyor, EPOCH'tan değil.
 *
 * Şart, ölçülerek bulundu: gün numarası 2024-01-01'den sayıldığında sekme turun
 * ortasından başlıyor, ilk 143 günde yalnızca 112 farklı dizi çıkıyordu (tur
 * ortada değişip yeniden karılıyor). Başlangıcı kaydırınca ilk tur tam 143 gün
 * sürüyor. Film sekmesinde AYNI kayma var ama oraya dokunulamaz — kaydırmak
 * geçmiş günlerin filmini değiştirirdi.
 */
const DIZI_BASLANGIC = "2026-08-15";

export function getDailyMovie(dateKey: string, kategoriId: string): KareselMovie | undefined {
  const havuz = havuzFor(kategoriId);
  if (havuz.length === 0) return undefined;

  const dizi = kategoriId === "dizi";
  const day = dizi ? dayNumber(dateKey) - dayNumber(DIZI_BASLANGIC) : dayNumber(dateKey);
  const cycle = Math.floor(day / havuz.length);
  const indexInCycle = positiveMod(day, havuz.length);
  /* Tur tohumu kategoriye göre AYRI ki iki sekmenin sırası bağımsız olsun.
     Film'in tohumu BİLEREK eski haliyle bırakıldı ("karesel-cycle-N", sekme
     sonekli değil): tohumu değiştirmek karışımı değiştirir, yani geçmiş
     günlerin filmini de kaydırırdı (bkz. CLAUDE.md, HAVUZ BÜYÜTME KURALI). */
  const tohum = kategoriId === "dizi" ? `karesel-dizi-cycle-${cycle}` : `karesel-cycle-${cycle}`;
  const order = seededShuffle(
    havuz.map((_, i) => i),
    hashString(tohum)
  );
  return havuz[order[indexInCycle]];
}

/**
 * O ana kadar AÇILMIŞ karelerin yolları. Şarkısal'da ses dosyasının tamamı client'a
 * gidip kesme işi client'ta yapılıyor (kararlı bir kullanıcı dosyanın tamamını
 * indirebilir); burada bu açık yok — henüz açılmamış karelerin URL'i client'a hiç
 * gönderilmiyor, her tahminde sunucu bir sonrakini ekliyor.
 */
export function getRevealedFrames(movie: KareselMovie, attempts: number): string[] {
  const revealedCount = Math.min(attempts + 1, movie.frames.length);
  return movie.frames.slice(0, revealedCount);
}

/** Host'un yerel TZ ayarından bağımsız, sabit UTC+3 (İstanbul, DST yok) "bugün" anahtarı. */
export function getServerTodayKey(): string {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface AttemptsPayload {
  date: string;
  /** Token kategoriye BAĞLI: olmasaydı bir sekmede alınan token diğerinde de
   *  geçerli olur, iki sekmenin hak sayacı tek havuz gibi kullanılabilirdi. */
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

/** Token'ı doğrular ve beklenen tarihle eşleşiyorsa attempts sayısını döner. Geçersizse null. */
export function verifyAttemptsToken(
  token: string,
  expectedDate: string,
  expectedKategori: string
): number | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
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

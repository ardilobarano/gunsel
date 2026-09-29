import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { CHAIN_LENGTH, DAHA_AZ_COK_CATEGORIES, MAX_STEPS } from "@/lib/dahaAzCok";
import { getDailyIndex } from "@/lib/dailySelection.server";
import { vekilleGorsel } from "@/lib/gorsel";
import { SONG_PLAYBACK } from "@/data/songPlayback.server";
import songsData from "@/data/songs.json";
import songViewCountsData from "@/data/songViewCounts.json";
import nufusData from "@/data/dahaAzCokNufus.json";
import filmData from "@/data/dahaAzCokFilm.json";
import diziData from "@/data/dahaAzCokDizi.json";
import fiyatData from "@/data/dahaAzCokFiyat.json";
import triviaData from "@/data/dahaAzCokTrivia.json";

if (!process.env.GUESS_TOKEN_SECRET) throw new Error("GUESS_TOKEN_SECRET tanımlı değil.");
const TOKEN_SECRET: string = process.env.GUESS_TOKEN_SECRET;

export interface DahaAzCokItem {
  id: string;
  label: string;
  value: number;
  unit: string;
  /** Film/Dizi kategorilerinde kartın tam arkaplanı olarak kullanılan afiş — TMDB'den. */
  imageUrl?: string | null;
}

interface Song {
  id: string;
  title: string;
  artist: string;
}

interface SongViewCountEntry {
  viewCount: number;
  thumbnailUrl: string | null;
}

const songs = songsData as Song[];
const songViewCounts = songViewCountsData as Record<string, SongViewCountEntry>;

/**
 * Görsel adresleri BURADA vekile çevriliyor — tek giriş noktası.
 *
 * `image.tmdb.org` kullanıcının sağlayıcısında DNS ile engelli; tarayıcı o
 * adrese doğrudan gittiği sürece afişler o ağdaki hiç kimseye açılmıyor
 * (bkz. `src/app/gorsel/[...yol]/route.ts`). Çeviri havuzun kurulduğu yerde
 * yapılıyor ki `/challenge`, `/guess`, `revealedItems` ve `/onizleme` — hepsi
 * kendiliğinden düzelsin; tek tek uçlara serpiştirilse biri unutulurdu.
 *
 * Veri dosyaları OLDUĞU GİBİ kalıyor (mutlak TMDB adresi). Üretici betikler
 * yazmaya devam ediyor, yeni veri geldiğinde kimsenin bir şey hatırlaması
 * gerekmiyor. TMDB dışındaki adresler (Wikipedia logoları) dokunulmadan geçiyor.
 */
const vekilleHavuz = (veri: unknown): DahaAzCokItem[] =>
  (veri as DahaAzCokItem[]).map((item) =>
    item.imageUrl ? { ...item, imageUrl: vekilleGorsel(item.imageUrl) } : item
  );

const STATIC_POOLS: Record<string, DahaAzCokItem[]> = {
  nufus: vekilleHavuz(nufusData),
  film: vekilleHavuz(filmData),
  dizi: vekilleHavuz(diziData),
  fiyat: vekilleHavuz(fiyatData),
  trivia: vekilleHavuz(triviaData),
};

/**
 * Havuz büyümeleri: bu tarihten ÖNCEKİ günler eski havuz boyutuyla oynanır.
 *
 * Gerekçe: günün zinciri havuzun TAMAMI karılarak seçiliyor (`seededShuffle`).
 * Havuza öğe eklemek karışımın sonucunu tamamen değiştirir, yani sadece gelecek
 * günleri değil GEÇMİŞ günleri de kaydırır — arşivden bir günü tekrar oynayan
 * kişi o gün oynadığından bambaşka bir zincir görürdü ve kaydettiği sonuç artık
 * başka bir zincire ait olurdu.
 *
 * ŞART: yeni öğeler havuzun SONUNA eklenmeli, ilk N öğe ve sırası aynı kalmalı.
 * `scripts/fetch-daha-az-cok-tmdb.ts` bu yüzden varsayılan olarak "ekle" modunda
 * çalışıyor ve mevcut kayıtlara dokunmuyor.
 */
const HAVUZ_BUYUMELERI: Record<string, { tarih: string; eskiBoyut: number }> = {
  film: { tarih: "2026-08-09", eskiBoyut: 50 },
  dizi: { tarih: "2026-08-09", eskiBoyut: 40 },
  fiyat: { tarih: "2026-08-09", eskiBoyut: 33 },
  /* Trivia'da kırpma iki kat önemli: yeni öğeler yeni BİRİM GRUPLARI da getirdi
     (hız, ömür, ağırlık...). Grup sayısı 3'ten 8'e çıktığı için kırpma olmadan
     geçmiş günler bambaşka bir birim ailesi gösterirdi. */
  trivia: { tarih: "2026-08-09", eskiBoyut: 32 },
};

/** Ayrık zincir seçimi bu tarihten itibaren geçerli — geçmiş günler eski
 *  zincirlerini korusun (bkz. HAVUZ_BUYUMELERI'ndeki aynı gerekçe). */
const AYRIM_TARIHI = "2026-08-09";

function havuzuTariheGoreKirp(
  categoryId: string,
  dateKey: string,
  pool: DahaAzCokItem[],
): DahaAzCokItem[] {
  const buyume = HAVUZ_BUYUMELERI[categoryId];
  if (!buyume || dateKey >= buyume.tarih) return pool;
  return pool.slice(0, buyume.eskiBoyut);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Küçük, bağımlılıksız seeded PRNG (mulberry32) — aynı seed her zaman aynı diziyi üretir. */
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

/** Tarih + kategoriye göre günün 6 öğelik dizisi — herkes aynı gün aynı diziyi görür.
 * İlk öğe referans olarak verilir, kalan 5'i tahmin edilir. Spotify kategorisinde havuz
 * (SONG_PLAYBACK) sabit, değer YouTube izlenme sayısı ve kart arkaplanı YouTube video
 * thumbnail'i — ikisi de songViewCounts.json'dan statik okunuyor (bkz.
 * scripts/fetch-youtube-viewcounts.ts). Canlı çekilmiyor: hem YouTube Data API quota'sı
 * çok düşük (istek başına arama+detay ~101 unit, günlük varsayılan kota 10.000 unit —
 * sayfa yüklemesi başına canlı çekim birkaç yüz istekte kotayı tüketir), hem de günün
 * cevabının gün içinde değişmemesi gerekiyor. Spotify'ın "popularity" alanı da denendi
 * ama Client Credentials akışında hiç dönmüyor (bkz. spotify.server.ts), bu yüzden önce
 * süre (duration_ms) kullanılmıştı — YouTube izlenme sayısı daha anlamlı/tanıdık bir
 * metrik olduğu için onun yerine geçti. */
export async function getDailySequence(dateKey: string, categoryId: string): Promise<DahaAzCokItem[] | undefined> {
  if (!DAHA_AZ_COK_CATEGORIES.some((c) => c.id === categoryId)) return undefined;

  const seed = hashString(`${dateKey}-${categoryId}`);

  if (categoryId === "spotify") {
    const candidates = seededShuffle(Object.keys(SONG_PLAYBACK), seed);
    const items: DahaAzCokItem[] = [];

    for (const songId of candidates) {
      if (items.length >= CHAIN_LENGTH) break;
      const song = songs.find((s) => s.id === songId);
      const entry = songViewCounts[songId];
      if (!song || !entry) continue;
      items.push({
        id: songId,
        label: `${song.title} - ${song.artist}`,
        value: entry.viewCount,
        unit: "izlenme",
        imageUrl: entry.thumbnailUrl,
      });
    }

    return items.length === CHAIN_LENGTH ? items : undefined;
  }

  const havuz = STATIC_POOLS[categoryId];
  if (!havuz) return undefined;
  const pool = havuzuTariheGoreKirp(categoryId, dateKey, havuz);
  if (pool.length < CHAIN_LENGTH) return undefined;

  /* Günün dizisi TEK BİR BİRİMDEN seçilir.
     Bu bir düzeltme: Trivia havuzunda metre/adet/km/km²/km-sa karışıktı ve oyun
     "206 kemik mi çok, çitanın hızı mı?" diye soruyordu — 5 karşılaştırmanın 4'ü
     farklı birimdeydi, yani kıyas anlamsızdı. Artık havuz birime göre gruplanıp
     gün için yeterli büyüklükte bir grup seçiliyor; grup seçimi de deterministik,
     böylece farklı günler farklı birim ailesi görüyor (bir gün dağ yükseklikleri,
     ertesi gün nehir uzunlukları). Tek birimli kategorilerde (Nüfus, Fiyat, Film)
     davranış değişmiyor — tek grup var. */
  const gruplar = new Map<string, DahaAzCokItem[]>();
  for (const item of pool) {
    const g = gruplar.get(item.unit);
    if (g) g.push(item);
    else gruplar.set(item.unit, [item]);
  }

  const uygun = [...gruplar.values()].filter((g) => g.length >= CHAIN_LENGTH);
  if (uygun.length === 0) return undefined;

  // Birim adına göre sırala: Map'in ekleme sırasına bağlı kalmasın, veri dosyasındaki
  // sıra değişince günün cevabı kaymasın.
  uygun.sort((a, b) => a[0].unit.localeCompare(b[0].unit, "tr"));
  const grup = uygun[getDailyIndex(`dahaAzCok-grup-${dateKey}-${categoryId}`, uygun.length)];

  const karisik = seededShuffle(grup, seed);
  if (dateKey < AYRIM_TARIHI) return karisik.slice(0, CHAIN_LENGTH);
  return ayrikZincirSec(karisik);
}

/**
 * Zincire alınan her öğe bir ÖNCEKİNDEN en az %2 farklı olacak şekilde seçilir.
 *
 * Neden: kategori kalitesi ölçüldüğünde (scripts/dogrula-daha-az-cok.ts) Dizi
 * zincirlerinin %60'ında, Film zincirlerinin %43'ünde en az bir karşılaştırmanın
 * yazı-turaya döndüğü çıktı — TMDB puanları 7,0-8,9 gibi dar bir banda sıkışık
 * ve 0,1 adımlarla ilerliyor, yani "8.4 mü 8.5 mi" gibi bilinemez çiftler
 * kaçınılmaz. Havuzu büyütmek bunu çözmüyor (ölçüldü: 40 öğede %63, 114 öğede
 * %60) çünkü sorun havuzun boyutu değil, değerlerin yoğunluğu.
 *
 * Sadece ARDIŞIK çiftlere bakılıyor, çünkü oyuncu yalnızca onları karşılaştırıyor.
 * Tam eşitlik de eleniyor: oyun eşitliği doğru sayıyor, yani zarar vermiyor ama
 * bedava puan olduğu için turu boşa harcıyor.
 */
const MIN_AYRIM = 0.02;

function yeterinceAyri(a: number, b: number): boolean {
  const buyuk = Math.max(Math.abs(a), Math.abs(b));
  if (buyuk === 0) return a !== b;
  return Math.abs(a - b) / buyuk >= MIN_AYRIM;
}

function ayrikZincirSec(karisik: DahaAzCokItem[]): DahaAzCokItem[] {
  const zincir: DahaAzCokItem[] = [];
  for (const oge of karisik) {
    const oncrki = zincir[zincir.length - 1];
    if (!oncrki || yeterinceAyri(oncrki.value, oge.value)) {
      zincir.push(oge);
      if (zincir.length === CHAIN_LENGTH) return zincir;
    }
  }
  /* Dar bantlı bir havuzda yeterince ayrık 6 öğe bulunamayabilir. O durumda
     ayrım şartı gevşetilerek tamamlanıyor: eksik zincir oyunu kırar, biraz zor
     bir karşılaştırma kırmaz. */
  const secilenler = new Set(zincir);
  for (const oge of karisik) {
    if (zincir.length === CHAIN_LENGTH) break;
    if (!secilenler.has(oge)) zincir.push(oge);
  }
  return zincir;
}

/** Host'un yerel TZ ayarından bağımsız, sabit UTC+3 (İstanbul, DST yok) "bugün" anahtarı. */
export function getServerTodayKey(): string {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface StepPayload {
  date: string;
  category: string;
  stepIndex: number;
  /** Yanlış tahmin oyunu bitirmiyor (sadece skor tutuluyor) — DB/oturum olmadığı için
   * o ana kadarki doğru sayısı da token'a gömülüyor, sunucu her istekte stateless kalıyor. */
  correctCount: number;
}

function sign(payload: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
}

export function signAttemptsToken(payload: StepPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Token'ı doğrular ve beklenen date/category ile eşleşiyorsa {stepIndex, correctCount} döner. Geçersizse null. */
export function verifyAttemptsToken(
  token: string,
  expected: { date: string; category: string }
): { stepIndex: number; correctCount: number } | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: StepPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.date !== expected.date || payload.category !== expected.category) return null;
  if (typeof payload.stepIndex !== "number" || payload.stepIndex < 0 || payload.stepIndex >= MAX_STEPS) {
    return null;
  }
  if (typeof payload.correctCount !== "number" || payload.correctCount < 0 || payload.correctCount > payload.stepIndex) {
    return null;
  }
  return { stepIndex: payload.stepIndex, correctCount: payload.correctCount };
}

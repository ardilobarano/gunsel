import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { OGELER } from "@/data/renkselOgeler";
import { puanla, TUR_SAYISI, type RenkselTur } from "@/lib/renksel";

if (!process.env.GUESS_TOKEN_SECRET) throw new Error("GUESS_TOKEN_SECRET tanımlı değil.");
const TOKEN_SECRET: string = process.env.GUESS_TOKEN_SECRET;

/** Her (öğe, parça) çifti ayrı bir soru — bir fotoğraf birden çok soru üretebilir. */
interface Soru {
  ogeId: string;
  baslik: string;
  kaynak: string;
  dosya: string;
  genislik: number;
  yukseklik: number;
  renk: string;
}

const SORULAR: Soru[] = OGELER.flatMap((o) =>
  o.parcalar.map((p) => ({
    ogeId: o.id,
    baslik: p.baslik,
    kaynak: o.kaynak,
    dosya: p.dosya,
    genislik: p.genislik,
    yukseklik: p.yukseklik,
    renk: p.renk,
  }))
);

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
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Sekmelerdeki dersle aynı: tur sayacı OYUNUN İLK GÜNÜNDEN başlıyor, sabit bir
 *  epoch'tan değil. Epoch'tan sayınca oyun turun ortasından başlıyor ve soru
 *  tekrarı çok erken geliyor (Haritasal İller ve Karesel Dizi'de ölçüldü). */
const BASLANGIC = "2026-08-17";
const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function positiveMod(v: number, m: number): number {
  return ((v % m) + m) % m;
}

/**
 * Günün 5 sorusu.
 *
 * Havuz her turda karılıp SIRAYLA geziliyor (Karesel/Haritasal ile aynı desen):
 * `hash(tarih) % havuz` deseni bağımsız seçim yaptığı için aynı gün içinde bile
 * aynı soruyu iki kez verebilirdi.
 *
 * AYNI FOTOĞRAF İKİ KEZ ÇIKMASIN: sıradaki soru zaten seçilmiş bir öğeye
 * aitse atlanıyor. Yoksa aynı günde aynı fotoğrafın iki ayrı bölgesi arka
 * arkaya geliyor, hem tekrar hissi veriyor hem de ikinci soruda görselin
 * tamamı zaten görülmüş oluyor.
 */
export function getGunlukSorular(dateKey: string): Soru[] {
  const gun = dayNumber(dateKey) - dayNumber(BASLANGIC);
  const tur = Math.floor((gun * TUR_SAYISI) / SORULAR.length);
  const sira = seededShuffle(
    SORULAR.map((_, i) => i),
    hashString(`renksel-tur-${tur}`)
  );

  const secilen: Soru[] = [];
  const kullanilan = new Set<string>();
  const basla = positiveMod(gun * TUR_SAYISI, SORULAR.length);
  for (let adim = 0; adim < SORULAR.length && secilen.length < TUR_SAYISI; adim++) {
    const soru = SORULAR[sira[(basla + adim) % SORULAR.length]];
    if (kullanilan.has(soru.ogeId)) continue;
    kullanilan.add(soru.ogeId);
    secilen.push(soru);
  }
  return secilen;
}

/**
 * Sorunun istemciye gidecek hâli — yalnızca varlıkların ADRESİ.
 *
 * Cevap istemciye hiç gitmiyor: `soru.renk` bu nesneye hiç girmiyor ve
 * gösterilen fotoğrafın maskeli bölgesi zaten üretim sırasında gri
 * baskılandığı için görselin kendisinden de okunamıyor.
 */
export function soruyuCiz(soru: Soru): RenkselTur {
  return {
    baslik: soru.baslik,
    kaynak: soru.kaynak,
    foto: `/renksel/${soru.dosya}.jpg`,
    maske: `/renksel/${soru.dosya}.png`,
    genislik: soru.genislik,
    yukseklik: soru.yukseklik,
  };
}

export function getServerTodayKey(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

interface TurPayload {
  date: string;
  /** Kaçıncı tur bekleniyor — istemcinin bildirdiği tur kabul edilmiyor. */
  tur: number;
  /** O ana kadar toplanan puan; sonucu istemci hesaplamıyor. */
  toplam: number;
}

function sign(body: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(body).digest("hex");
}

export function signTurToken(payload: TurPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyTurToken(token: string, expectedDate: string): TurPayload | null {
  const [body, imza] = token.split(".");
  if (!body || !imza) return null;
  const a = Buffer.from(imza);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let p: TurPayload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (p.date !== expectedDate) return null;
  if (typeof p.tur !== "number" || p.tur < 0 || p.tur >= TUR_SAYISI) return null;
  if (typeof p.toplam !== "number" || p.toplam < 0 || p.toplam > TUR_SAYISI * 10) return null;
  return p;
}

/** Tahmini puanlar; doğru rengi de döner (tur bitti, artık gizlemeye gerek yok). */
export function turuPuanla(dateKey: string, tur: number, tahmin: string) {
  const soru = getGunlukSorular(dateKey)[tur];
  return { puan: puanla(tahmin, soru.renk), dogru: soru.renk };
}

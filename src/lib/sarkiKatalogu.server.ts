import "server-only";
import katalogData from "@/data/sarkiKatalogu.json";
import songsData from "@/data/songs.json";
import overridesData from "@/data/songOverrides.json";
import { SONG_PLAYBACK } from "@/data/songPlayback.server";
import { foldTurkish } from "@/lib/spotify.server";

/**
 * Şarkısal'ın tahmin kutusunun arama kaynağı.
 *
 * NEDEN YEREL: arama eskiden Spotify'ı canlı proxy'liyordu ve bu sürdürülebilir
 * değildi. Ölçüldü (Ağustos 2026):
 *   - Development Mode'a uzun pencereli KOTA geldi; dolunca arama tamamen
 *     duruyor ve `Retry-After` 15 saat olabiliyor. Bir kere tam olarak bu oldu.
 *   - Kota geliştirici HESABI başına sayılıyor — yeni uygulama açmak çözmüyor.
 *   - Genişletilmiş kota yalnızca 250 bin aylık aktif kullanıcılı kurumlara
 *     veriliyor.
 *   - Kota dolmasa bile `artist:"X"` gibi alan-kapsamlı sorgular en fazla 5
 *     sonuç dönüyor, yani arama zaten zayıflamıştı.
 * Ayrıca her tuş duraksamasında sunucu Spotify'a 3-4 istek atıyordu; oyuncu
 * sayısı arttıkça kota her gün dolardı. Artık çalışma anında dış istek YOK.
 *
 * KATALOG NEREDEN: `npm run sarkisal:katalog` ile Spotify'dan bir kez toplanıp
 * `src/data/sarkiKatalogu.json`'a yazılıyor. Yenilemek gerektiğinde aynı komut.
 *
 * CEVAP HER ZAMAN BULUNABİLİR: katalog ne kadar geniş olursa olsun, oyunun
 * kendi şarkıları (yedek havuz + elle konmuş günlük şarkılar) katalogda
 * olmayabilirdi. Bu yüzden ikisi de ayrıca ekleniyor — aksi hâlde bir gün
 * cevabı yazılamayan bir oyun çıkardı.
 */

interface KatalogKaydi {
  i: string;
  t: string;
  a: string;
}
interface Song {
  id: string;
  title: string;
  artist: string;
}
interface OverrideEntry {
  title: string;
  artist: string;
  spotifyTrackId?: string;
}

export interface AramaSonucu {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
}

interface Kayit extends AramaSonucu {
  /** Önceden katlanmış arama alanları — her tuşta yeniden hesaplanmasın. */
  kt: string;
  ka: string;
}

function kucult(s: string): string {
  return foldTurkish(s.toLocaleLowerCase("tr-TR"));
}

let katalog: Kayit[] | null = null;

function kur(): Kayit[] {
  const bilinen = new Map<string, Kayit>();

  const ekle = (id: string, title: string, artist: string) => {
    /* Anahtar başlık+sanatçı: Spotify aynı şarkıyı single/albüm/derleme olarak
       farklı id'lerle veriyor, listede iki kez görünmesin. */
    const anahtar = `${kucult(title)}|${kucult(artist)}`;
    if (bilinen.has(anahtar)) return;
    bilinen.set(anahtar, {
      id,
      title,
      artist,
      /* Süre gösterilmiyor; alan yalnızca mevcut arayüz sözleşmesi için var. */
      durationMs: 0,
      kt: kucult(title),
      ka: kucult(artist),
    });
  };

  for (const k of katalogData as KatalogKaydi[]) ekle(k.i, k.t, k.a);

  /* Remiks/alternatif sürümleri, ASIL kayıt zaten listedeyse çıkar. Ölçüldü:
     "tarkan" aramasında 8 satırın 3'ünü "Adımı Kalbine Yaz - Ozinga Club Mix"
     gibi varyantlar yiyordu. Asıl kayıt yoksa varyant kalıyor — hiç çıkmamasından
     iyi. */
  const varyant = /\s-\s.*\b(mix|remix|version|edit|remaster|akustik|acoustic|live|canlı)\b/i;
  for (const [anahtar, kayit] of [...bilinen]) {
    if (!varyant.test(kayit.title)) continue;
    const temel = kayit.title.split(" - ")[0].trim();
    if (bilinen.has(`${kucult(temel)}|${kucult(kayit.artist)}`)) bilinen.delete(anahtar);
  }

  /* Oyunun kendi şarkıları — id ZORUNLU olarak Spotify track id'si olmalı,
     çünkü /guess doğruluğu `spotifyTrackId` karşılaştırmasıyla ölçülüyor. */
  for (const s of songsData as Song[]) {
    const trackId = SONG_PLAYBACK[s.id]?.spotifyTrackId;
    if (trackId) ekle(trackId, s.title, s.artist);
  }
  const overrides = overridesData as Record<string, Record<string, OverrideEntry>>;
  for (const gun of Object.values(overrides)) {
    for (const kayit of Object.values(gun)) {
      if (kayit.spotifyTrackId) ekle(kayit.spotifyTrackId, kayit.title, kayit.artist);
    }
  }

  return [...bilinen.values()];
}

export function katalogBoyutu(): number {
  katalog ??= kur();
  return katalog.length;
}

/**
 * Sıralama: önce sanatçı+şarkı birlikte eşleşenler, sonra baştan eşleşenler,
 * sonra içinde geçenler. Oyuncu "ezhel mar" gibi iki parçalı da yazabiliyor,
 * o yüzden sorgu kelimelere bölünüp hepsinin geçmesi aranıyor.
 */
export function katalogdaAra(query: string, limit = 8): AramaSonucu[] {
  const q = kucult(query.trim());
  if (!q) return [];
  katalog ??= kur();

  const kelimeler = q.split(" ").filter(Boolean);

  /* TAM eşleşmeler öneklerin ÜSTÜNDE. Sebep ölçüldü: "sezen aksu" arandığında
     ilk sırada Lvbel C5'in "Sezen Aksu" adlı şarkısı çıkıyordu, çünkü başlık
     öneki sanatçı eşleşmesini geçiyordu. Sanatçı adını yazan oyuncu o
     sanatçının şarkılarını arıyor. */
  const puanla = (k: Kayit): number => {
    const hepsi = `${k.ka} ${k.kt}`;
    if (!kelimeler.every((w) => hepsi.includes(w))) return -1;
    if (k.ka === q) return 0;
    if (k.kt === q) return 1;
    if (k.ka.startsWith(q)) return 2;
    if (k.kt.startsWith(q)) return 3;
    if (k.kt.includes(q)) return 4;
    if (k.ka.includes(q)) return 5;
    return 6;
  };

  const bulunan: { k: Kayit; p: number }[] = [];
  for (const k of katalog) {
    const p = puanla(k);
    if (p >= 0) bulunan.push({ k, p });
  }

  bulunan.sort((a, b) => a.p - b.p || a.k.title.localeCompare(b.k.title, "tr"));

  return bulunan.slice(0, limit).map(({ k }) => ({
    id: k.id,
    title: k.title,
    artist: k.artist,
    durationMs: k.durationMs,
  }));
}

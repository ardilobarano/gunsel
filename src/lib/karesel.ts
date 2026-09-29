import { tmdbGorsel } from "@/lib/gorsel";
/** Karesel: her tahminde bir kare daha açılır, 6 kare / 6 deneme (Framed türevi). */
export const FRAME_COUNT = 6;
export const MAX_ATTEMPTS = FRAME_COUNT;

export const GAME_ID = "karesel";

/** Sekmeler. Sıra ekrandaki sıra; ilki varsayılan. */
export const KARESEL_KATEGORILERI = [
  { id: "film", label: "Film" },
  { id: "dizi", label: "Dizi" },
] as const;

export type KareselKategoriId = (typeof KARESEL_KATEGORILERI)[number]["id"];

export function gecerliKategori(id: string): id is KareselKategoriId {
  return KARESEL_KATEGORILERI.some((k) => k.id === id);
}

/**
 * Kategorinin istatistik/ilerleme anahtarı.
 *
 * Film sekmesi düz `karesel` KALIYOR: oyun bu kimlikle oynanmış durumda, kimliği
 * `karesel-film`e çevirmek kayıtlı serileri ve DailyResult satırlarını öksüz
 * bırakırdı. Haritasal'ın İller sekmesinde de aynı karar verilmişti.
 */
export function getKareselGameId(kategoriId: string): string {
  return kategoriId === "dizi" ? "karesel-dizi" : GAME_ID;
}

/** TMDB kare boyutu — w780 mobil/masaüstü için yeterli, orijinal gereksiz ağır. */
export const TMDB_KARE_BOYUTU = "w780";

/** TMDB aramasından dönen, tahmin olarak seçilebilecek herhangi bir film. */
export interface MovieResult {
  tmdbId: number;
  title: string;
  originalTitle: string;
  year: string | null;
}

/** Bir tahmin satırı — Şarkısal'daki SongGuessEntry ile aynı desen. */
export interface MovieGuessEntry {
  skipped: boolean;
  title?: string;
  year?: string | null;
  tmdbId?: number;
}

/**
 * Karenin adresi — TMDB'ye DEĞİL, kendi alan adımızdaki vekile çıkıyor.
 * `image.tmdb.org` kullanıcının sağlayıcısında DNS ile engelli olduğu için
 * doğrudan adres verildiğinde kareler o ağdaki hiç kimseye açılmıyordu.
 * Bkz. `src/app/gorsel/[...yol]/route.ts`.
 */
export function getFrameUrl(framePath: string): string {
  return tmdbGorsel(framePath, TMDB_KARE_BOYUTU);
}

/** Tahmin listesinde/aramada gösterilecek etiket: "Başlangıç (2010)". */
export function formatMovieLabel(title: string, year: string | null | undefined): string {
  return year ? `${title} (${year})` : title;
}

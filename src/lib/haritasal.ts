export const GAME_ID = "haritasal";
export const MAX_ATTEMPTS = 6;

/** Sekmeler. Sıra ekrandaki sıra; ilki varsayılan. */
export const HARITASAL_KATEGORILERI = [
  { id: "dunya", label: "Dünya Ülkeleri" },
  { id: "iller", label: "Türkiye İlleri" },
] as const;

export type HaritasalKategoriId = (typeof HARITASAL_KATEGORILERI)[number]["id"];

export function gecerliKategori(id: string): id is HaritasalKategoriId {
  return HARITASAL_KATEGORILERI.some((k) => k.id === id);
}

/**
 * Kategorinin istatistik/ilerleme anahtarı.
 *
 * Dünya sekmesi düz `haritasal` KALIYOR — Şarkısal'daki `sarkisal-${id}` deseni
 * burada tekrarlanmadı, çünkü Haritasal zaten bu kimlikle oynanmış durumda:
 * kimliği `haritasal-dunya`ya çevirmek hem kayıtlı serileri hem veritabanındaki
 * DailyResult satırlarını öksüz bırakırdı. Yeni sekme sonek alıyor.
 */
export function getHaritasalGameId(kategoriId: string): string {
  return kategoriId === "iller" ? "haritasal-iller" : GAME_ID;
}

/** Bir tahminin sonucu — sunucudan geliyor, hepsi orada hesaplanıyor. */
export interface HaritasalGuessEntry {
  /** Tahmin edilen ülkenin görünen adı. */
  label: string;
  /**
   * Sıcaklık kademesi (HEAT_LEVELS indeksi). Doğru tahminde -1.
   *
   * Kilometre BİLEREK gönderilmiyor: hem ekranda gösterilmiyor (emoji ile
   * birlikte iki kez aynı bilgi oluyordu, emoji süse dönüyordu) hem de
   * gönderilip gizlenseydi tarayıcı konsolundan bakan kesin mesafeyi görüp
   * avantaj sağlardı. Eşiklerin km karşılığı "Nasıl Oynanır"da yazıyor.
   */
  heat: number;
  /** 0-360 derece, kuzeyden saat yönünde. Doğru tahminde null. */
  bearing: number | null;
  correct: boolean;
}

/**
 * Sıcaklık kademeleri — MESAFEYE göre.
 *
 * Önce yüzdelik bir "yakınlık" gösteriliyordu ve yanıltıcıydı: ölçüldü, tüm ülke
 * çiftlerinin %75'i 50'nin üstünde çıkıyordu, yani bir kıta ötesindeki tahmin bile
 * "%75 yakın" görünüyordu. Yüzde yerine sıcak/soğuk emojisi kondu: hem tek bakışta
 * okunuyor hem de eşikler somut (kaç km olduğu yanında zaten yazıyor).
 *
 * Eşikler ÖLÇÜLEREK dengelendi. İlk deneme 5 kademeliydi ve en üst kademe
 * (>8.000 km) tüm ülke çiftlerinin %40'ını yutuyordu — üç ayrı tahmin de
 * "Buz gibi" çıkıyor, oyuncu hiçbir şey öğrenemiyordu. Altı kademeye çıkarılıp
 * eşikler kaydırılınca dağılım dengelendi:
 *   🔥 %5 · ☀️ %18 · ⛅ %25 · ❄️ %21 · 🧊 %22 · 🌍 %10
 */
const DUNYA_HEAT_LEVELS = [
  { maxKm: 1000, emoji: "🔥", label: "Çok yakın" },
  { maxKm: 3000, emoji: "☀️", label: "Sıcak" },
  { maxKm: 6000, emoji: "⛅", label: "Ilık" },
  { maxKm: 9000, emoji: "❄️", label: "Soğuk" },
  { maxKm: 13000, emoji: "🧊", label: "Buz gibi" },
  { maxKm: Infinity, emoji: "🌍", label: "Dünyanın öbür ucu" },
] as const;

/**
 * İl eşikleri AYRI olmak ZORUNDA. Türkiye'nin iki ucu arası 1.580 km, yani
 * dünya eşikleri kullanılsaydı 81 ilin 3.240 çiftinin TAMAMI ilk kademeye
 * ("🔥 Çok yakın") düşerdi — ipucu diye bir şey kalmazdı.
 *
 * Eşikler ülkelerdekiyle aynı yöntemle, tüm il çiftlerinin mesafesi ölçülerek
 * seçildi ve dünya sekmesinin dağılımına denk geliyor:
 *   🔥 %6 · ☀️ %15 · ⛅ %25 · ❄️ %20 · 🧊 %22 · 🗺️ %11
 * (dünya: %5 · %18 · %25 · %21 · %22 · %10)
 */
const IL_HEAT_LEVELS = [
  { maxKm: 150, emoji: "🔥", label: "Çok yakın" },
  { maxKm: 300, emoji: "☀️", label: "Sıcak" },
  { maxKm: 500, emoji: "⛅", label: "Ilık" },
  { maxKm: 700, emoji: "❄️", label: "Soğuk" },
  { maxKm: 1050, emoji: "🧊", label: "Buz gibi" },
  /* Emoji merdiveni iki sekmede de AYNI (yalnızca etiket ve eşik değişiyor):
     "Nasıl Oynanır" penceresi tek bir emoji listesi gösterip yanına iki sütun
     eşik yazıyor, farklı emoji kullansaydım o liste ikiye bölünürdü. */
  { maxKm: Infinity, emoji: "🌍", label: "Ülkenin öbür ucu" },
] as const;

export function heatLevels(
  kategoriId: string
): readonly { maxKm: number; emoji: string; label: string }[] {
  return kategoriId === "iller" ? IL_HEAT_LEVELS : DUNYA_HEAT_LEVELS;
}

/** Mesafeyi kademe indeksine çevirir — SUNUCUDA kullanılıyor. */
export function heatIndexFor(km: number, kategoriId: string): number {
  const seviyeler = heatLevels(kategoriId);
  const i = seviyeler.findIndex((l) => km < l.maxKm);
  return i === -1 ? seviyeler.length - 1 : i;
}

export function heatFor(
  entry: Pick<HaritasalGuessEntry, "heat" | "correct">,
  kategoriId: string
): { emoji: string; label: string } {
  if (entry.correct) return { emoji: "🎯", label: "Doğru" };
  const seviyeler = heatLevels(kategoriId);
  return seviyeler[entry.heat] ?? seviyeler[seviyeler.length - 1];
}

/** Yönü sekiz yönlü oka çevirir. Tam kuzey 0°, saat yönünde artıyor. */
export function bearingToArrow(bearing: number | null): string {
  if (bearing === null) return "🎯";
  const oklar = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
  return oklar[Math.round(bearing / 45) % 8];
}

/** Paylaşım ızgarası — aynı sıcaklık kademelerinden türüyor ki paylaşılan sonuç
 *  ekranda görülenle aynı şeyi anlatsın. Ülke adını ele vermiyor. */
export function proximityToSquare(entry: HaritasalGuessEntry): string {
  if (entry.correct) return "🟩";
  if (entry.heat === 0) return "🟧";
  if (entry.heat <= 2) return "🟨";
  return "⬜";
}

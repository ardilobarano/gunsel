/**
 * Dış görsel adreslerini KENDİ alan adımızdaki vekile çeviren yardımcılar.
 *
 * NEDEN: `image.tmdb.org` kullanıcının internet sağlayıcısında DNS ile engelli
 * (127.0.0.1'e çözülüyor, ölçüldü). Tarayıcı o adrese doğrudan gittiği sürece
 * aynı sağlayıcıdaki hiç kimse Karesel'in karelerini ve Daha Az/Çok'un
 * afişlerini göremiyor. Vekil `src/app/gorsel/[...yol]/route.ts`.
 *
 * Bu dosya bilerek sunucu-özel DEĞİL: hem sunucuda (veri istemciye
 * gönderilirken) hem istemcide (kare adresi kurulurken) kullanılıyor.
 */

/** Vekilin kök yolu. Tek yerde durması şart — hem burada hem route'ta değişmeli. */
export const GORSEL_VEKIL = "/gorsel";

/** TMDB kare/afiş yolu (`/abc.jpg`) → kendi alan adımızdaki adres. */
export function tmdbGorsel(yol: string, boyut = "w780"): string {
  const temiz = yol.startsWith("/") ? yol.slice(1) : yol;
  return `${GORSEL_VEKIL}/tmdb/${boyut}/${temiz}`;
}

/**
 * Veri dosyalarındaki MUTLAK TMDB adreslerini vekile çevirir.
 *
 * Veri dosyalarını (`dahaAzCokFilm.json`, `dahaAzCokDizi.json`) toplu
 * düzenlemek yerine okuma anında çevirmek bilinçli: üretici betikler TMDB'den
 * mutlak adres yazmaya devam ediyor, yeni veri geldiğinde kimsenin bir şeyi
 * hatırlaması gerekmiyor. Tanınmayan adresler olduğu gibi geçiyor —
 * flagcdn ve Wikipedia görselleri engellenmiş değil, onları vekile sokmak
 * gereksiz yük olurdu.
 */
export function vekilleGorsel(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  const eslesme = /^https?:\/\/image\.tmdb\.org\/t\/p\/([^/]+)\/(.+)$/.exec(url);
  if (!eslesme) return url;
  return `${GORSEL_VEKIL}/tmdb/${eslesme[1]}/${eslesme[2]}`;
}

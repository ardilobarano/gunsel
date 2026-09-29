export type Skin = "pop" | "klasik";

/**
 * Sitenin varsayılan görünümü.
 *
 * TÜMÜNÜ ESKİYE DÖNDÜRMEK İÇİN: burayı "klasik" yapıp deploy etmek yeterli.
 * Hiçbir bileşen görünüme bağlı değil — Pop tamamen globals.css'teki
 * [data-skin="pop"] bloğunda yaşıyor, klasik görünüm o blok devre dışı kalınca
 * birebir eski haline döner.
 */
export const DEFAULT_SKIN: Skin = "pop";

/** Her görünümün kendi varsayılan teması var: Pop açık zemin için tasarlandı. */
export const DEFAULT_THEME: Record<Skin, "dark" | "light"> = {
  pop: "light",
  klasik: "dark",
};

export const SKIN_STORAGE_KEY = "gunsel_skin";
const SKIN_EVENT = "gunsel-skinchange";

export function getSkin(): Skin {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  try {
    const value = window.localStorage.getItem(SKIN_STORAGE_KEY);
    return value === "pop" || value === "klasik" ? value : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function setSkin(skin: Skin): void {
  try {
    window.localStorage.setItem(SKIN_STORAGE_KEY, skin);
  } catch {
    // localStorage kapalıysa seçim sadece bu oturum için geçerli olur.
  }
  document.documentElement.dataset.skin = skin;
  window.dispatchEvent(new Event(SKIN_EVENT));
}

export function subscribeToSkin(callback: () => void): () => void {
  window.addEventListener(SKIN_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SKIN_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

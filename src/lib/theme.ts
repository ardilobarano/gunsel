import { DEFAULT_SKIN, DEFAULT_THEME, getSkin } from "@/lib/skin";

export type Theme = "dark" | "light";

const STORAGE_KEY = "gunsel_theme";
const THEME_EVENT = "gunsel-themechange";

/** Kayıtlı tercih yoksa varsayılan tema GÖRÜNÜME bağlı: Pop açık, klasik koyu. */
export function getTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME[DEFAULT_SKIN];
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
    return DEFAULT_THEME[getSkin()];
  } catch {
    return DEFAULT_THEME[DEFAULT_SKIN];
  }
}

export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage kapalıysa tema sadece bu oturum için geçerli olur.
  }
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeToTheme(callback: () => void): () => void {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

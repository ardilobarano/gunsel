"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gunsel_help_seen";

type SeenMap = Record<string, boolean>;

function readSeen(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

function markSeen(gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSeen(), [gameId]: true }));
  } catch {
    // Depolama kapalıysa (gizli sekme vb.) sessizce geç — sadece popup her seferinde açılır.
  }
}

/**
 * Bir oyuna İLK kez girildiğinde "Nasıl Oynanır?" penceresini kendiliğinden açar.
 *
 * "Görüldü" bilgisi localStorage'da tutuluyor, yani her yeni cihaz/tarayıcıda tekrar
 * gösteriliyor — istenen davranış bu. Hesaba bağlamadık: kullanıcıların çoğu girişsiz
 * oynuyor, ayrıca aynı cihazda hesap değiştiren birine aynı açıklamayı tekrar
 * göstermek bilgi değil rahatsızlık olurdu.
 *
 * setState effect gövdesinde SENKRON çağrılmıyor (projenin react-hooks kuralı) ve
 * localStorage render sırasında okunmuyor — ikisi de sunucu/istemci farkı (hydration)
 * hatasına yol açardı; okuma ilk boyamadan sonra timeout içinde yapılıyor.
 */
export function useFirstVisitHelp(gameId: string) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!readSeen()[gameId]) setOpen(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [gameId]);

  const openHelp = useCallback(() => setOpen(true), []);

  // Kapatma anında işaretleniyor: kullanıcı pencereyi gördü demektir.
  const closeHelp = useCallback(() => {
    markSeen(gameId);
    setOpen(false);
  }, [gameId]);

  return { open, openHelp, closeHelp };
}

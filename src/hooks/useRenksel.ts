"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GAME_ID, TUR_SAYISI, type RenkselSonuc, type RenkselTur } from "@/lib/renksel";
import { getGameStat, setGameStat, syncFinishedGamePayload } from "@/lib/storage";
import type { GameStatus } from "@/lib/types";
import { getTodayKey } from "@/lib/utils";

interface ChallengeResponse {
  turlar: RenkselTur[];
  turToken: string;
}

interface GuessResponse {
  puan: number;
  dogru: string;
  toplam: number;
  bitti: boolean;
  turToken?: string;
}

export function useRenksel(arsivTarihi?: string) {
  const todayKey = useMemo(() => arsivTarihi ?? getTodayKey(), [arsivTarihi]);
  /* Arşiv sonuçları ayrı alana yazılır — geriye dönük seri üretilmesin. */
  const isArsiv = !!arsivTarihi;

  const [sonuclar, setSonuclar] = useState<RenkselSonuc[]>(
    () => getGameStat(GAME_ID, todayKey, isArsiv)?.renkselSonuclar ?? []
  );
  const [status, setStatus] = useState<GameStatus>(
    () => getGameStat(GAME_ID, todayKey, isArsiv)?.status ?? "PLAYING"
  );
  const [storedToken] = useState(() => getGameStat(GAME_ID, todayKey, isArsiv)?.attemptsToken);

  const [turlar, setTurlar] = useState<RenkselTur[]>([]);
  const [turToken, setTurToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/renksel/challenge?date=${todayKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ChallengeResponse | null) => {
        if (cancelled) return;
        if (data) {
          setTurlar(data.turlar);
          setTurToken(storedToken ?? data.turToken);
        } else setNotFound(true);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [todayKey, storedToken]);

  const persist = useCallback(
    (next: RenkselSonuc[], nextStatus: GameStatus, nextToken?: string) => {
      setSonuclar(next);
      setStatus(nextStatus);
      if (nextStatus !== "PLAYING") setShowResult(true);
      const stat = {
        status: nextStatus,
        attempts: next.length,
        renkselSonuclar: next,
        attemptsToken: nextToken,
      };
      setGameStat(GAME_ID, stat, todayKey, isArsiv);
      if (nextStatus !== "PLAYING") syncFinishedGamePayload(GAME_ID, todayKey, stat);
    },
    [todayKey, isArsiv]
  );

  const tahminGonder = useCallback(
    async (tahmin: string) => {
      if (status !== "PLAYING" || !turToken || submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/renksel/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: todayKey, tahmin, turToken }),
        });
        if (!res.ok) return;
        const data: GuessResponse = await res.json();
        const next = [...sonuclar, { tahmin, dogru: data.dogru, puan: data.puan }];
        if (data.bitti) persist(next, "WON");
        else if (data.turToken) {
          setTurToken(data.turToken);
          persist(next, "PLAYING", data.turToken);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [status, turToken, submitting, sonuclar, todayKey, persist]
  );

  const toplam = sonuclar.reduce((s, x) => s + x.puan, 0);

  return {
    loading,
    notFound,
    status,
    turlar,
    sonuclar,
    /* Kaçıncı turdayız: kaydedilmiş sonuç sayısı. Sunucu da aynı sayıyı imzalı
       token'dan biliyor, yani buradaki değer yalnızca gösterim için. */
    turIndeksi: sonuclar.length,
    turSayisi: TUR_SAYISI,
    toplam: Math.round(toplam * 10) / 10,
    ortalama: sonuclar.length > 0 ? Math.round((toplam / sonuclar.length) * 10) / 10 : 0,
    submitting,
    showResult,
    tahminGonder,
    dismissResult: () => setShowResult(false),
    openResult: () => setShowResult(true),
  };
}

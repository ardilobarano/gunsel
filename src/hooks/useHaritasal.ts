"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getHaritasalGameId, MAX_ATTEMPTS, type HaritasalGuessEntry } from "@/lib/haritasal";
import { getGameStat, setGameStat, syncFinishedGamePayload } from "@/lib/storage";
import type { GameStatus } from "@/lib/types";
import { getTodayKey } from "@/lib/utils";

/** Oyun bitince acilan bolge: dunyada bayrak, illerde plaka. */
interface Revealed {
  label: string;
  flag?: string;
  plaka?: number;
}

interface Secenek {
  id: string;
  label: string;
}

interface ChallengeResponse {
  path: string;
  options: Secenek[];
  attemptsToken: string;
}

interface GuessResponse {
  entry: HaritasalGuessEntry;
  answer?: Revealed;
  attemptsToken?: string;
}

export function useHaritasal(kategoriId: string, arsivTarihi?: string) {
  const todayKey = useMemo(() => arsivTarihi ?? getTodayKey(), [arsivTarihi]);
  /* Arşiv sonuçları ayrı alana yazılır — geriye dönük seri üretilmesin (bkz. storage.ts). */
  const isArsiv = !!arsivTarihi;
  const gameId = useMemo(() => getHaritasalGameId(kategoriId), [kategoriId]);

  const [guesses, setGuesses] = useState<HaritasalGuessEntry[]>(
    () => getGameStat(gameId, todayKey, isArsiv)?.haritasalGuesses ?? []
  );
  const [status, setStatus] = useState<GameStatus>(
    () => getGameStat(gameId, todayKey, isArsiv)?.status ?? "PLAYING"
  );
  const [revealed, setRevealed] = useState<Revealed | null>(
    () => getGameStat(gameId, todayKey, isArsiv)?.revealedCountry ?? null
  );

  const [path, setPath] = useState<string | null>(null);
  const [options, setOptions] = useState<Secenek[]>([]);
  const [attemptsToken, setAttemptsToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* Devam etmenin tek yolu sunucunun imzaladığı token — ilerlemeyi /challenge'a
     bildirmek diğer oyunlarda cevabı sızdıran bir açıktı, o desen tekrarlanmıyor. */
  const [storedToken] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.attemptsToken);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/haritasal/challenge?date=${todayKey}&kategori=${kategoriId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ChallengeResponse | null) => {
        if (cancelled) return;
        if (data) {
          setPath(data.path);
          setOptions(data.options);
          setAttemptsToken(storedToken ?? data.attemptsToken);
        } else {
          setNotFound(true);
        }
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
  }, [todayKey, kategoriId, storedToken]);

  const persist = useCallback(
    (
      nextGuesses: HaritasalGuessEntry[],
      nextStatus: GameStatus,
      nextRevealed: Revealed | null,
      nextToken?: string
    ) => {
      setGuesses(nextGuesses);
      setStatus(nextStatus);
      setRevealed(nextRevealed);
      if (nextStatus !== "PLAYING") setShowResult(true);
      const stat = {
        status: nextStatus,
        attempts: nextGuesses.length,
        haritasalGuesses: nextGuesses,
        revealedCountry: nextRevealed ?? undefined,
        attemptsToken: nextToken,
      };
      setGameStat(gameId, stat, todayKey, isArsiv);
      if (nextStatus !== "PLAYING") syncFinishedGamePayload(gameId, todayKey, stat);
    },
    [gameId, todayKey, isArsiv]
  );

  const sendGuess = useCallback(
    async (countryId: string | null) => {
      if (status !== "PLAYING" || !attemptsToken || submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/haritasal/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: todayKey, kategori: kategoriId, countryId, attemptsToken }),
        });
        if (!res.ok) return;

        const data: GuessResponse = await res.json();
        const next = [...guesses, data.entry];

        if (data.answer) {
          persist(next, data.entry.correct ? "WON" : "LOST", data.answer);
        } else if (data.attemptsToken) {
          setAttemptsToken(data.attemptsToken);
          persist(next, "PLAYING", null, data.attemptsToken);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [status, attemptsToken, submitting, guesses, todayKey, kategoriId, persist]
  );

  return {
    loading,
    notFound,
    status,
    path,
    options,
    guesses,
    revealed,
    maxAttempts: MAX_ATTEMPTS,
    submitting,
    showResult,
    submitGuess: (id: string) => sendGuess(id),
    dismissResult: () => setShowResult(false),
    openResult: () => setShowResult(true),
  };
}

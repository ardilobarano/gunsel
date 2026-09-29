"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getKareselGameId, MAX_ATTEMPTS, type MovieGuessEntry, type MovieResult } from "@/lib/karesel";
import { getGameStat, setGameStat, syncFinishedGamePayload } from "@/lib/storage";
import type { GameStatus } from "@/lib/types";
import { getTodayKey } from "@/lib/utils";

interface RevealedMovie {
  title: string;
  originalTitle: string;
  year: string | null;
}

interface ChallengeResponse {
  frames: string[];
  attemptsToken: string;
}

interface GuessResponse {
  correct: boolean;
  frames?: string[];
  answer?: RevealedMovie;
  attemptsToken?: string;
}

export function useKaresel(kategoriId: string, arsivTarihi?: string) {
  const todayKey = useMemo(() => arsivTarihi ?? getTodayKey(), [arsivTarihi]);
  /* Arşiv modunda sonuç AYRI alana yazılır: aynı yere yazsaydı geçmiş günleri
     sırayla oynayan biri kendine geriye dönük seri üretebilirdi (bkz. storage.ts). */
  const isArsiv = !!arsivTarihi;
  const gameId = useMemo(() => getKareselGameId(kategoriId), [kategoriId]);

  const [movieGuesses, setMovieGuesses] = useState<MovieGuessEntry[]>(
    () => getGameStat(gameId, todayKey, isArsiv)?.movieGuesses ?? []
  );
  const [status, setStatus] = useState<GameStatus>(() => getGameStat(gameId, todayKey, isArsiv)?.status ?? "PLAYING");
  const [revealedMovie, setRevealedMovie] = useState<RevealedMovie | null>(
    () => getGameStat(gameId, todayKey, isArsiv)?.revealedMovie ?? null
  );
  // Kareler sunucudan geliyor ama localStorage'daki kopya sayesinde sayfa açılır
  // açılmaz (istek dönmeden) doğru kareler gösterilebiliyor.
  const [frames, setFrames] = useState<string[]>(() => getGameStat(gameId, todayKey, isArsiv)?.revealedFrames ?? []);

  const [attemptsToken, setAttemptsToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Devam etme: sunucunun EN SON İMZALADIĞI token. Tahmin sayısını /challenge'a
     bildirmek hem cevabı iki istekte sızdırıyor hem de açılmamış kareleri
     erkenden verdiriyordu (bkz. challenge route). */
  const [storedToken] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.attemptsToken);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/karesel/challenge?date=${todayKey}&kategori=${kategoriId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ChallengeResponse | null) => {
        if (cancelled) return;
        if (data) {
          setAttemptsToken(storedToken ?? data.attemptsToken);
          // Oyun bittiyse localStorage'daki tam kare listesi sunucununkinden uzun
          // olabilir (bitince hepsi açılıyor) — kısaltmamak için uzun olanı koru.
          setFrames((prev) => (prev.length >= data.frames.length ? prev : data.frames));
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
      nextGuesses: MovieGuessEntry[],
      nextStatus: GameStatus,
      nextFrames: string[],
      nextRevealed: RevealedMovie | null,
      nextToken?: string
    ) => {
      setMovieGuesses(nextGuesses);
      setStatus(nextStatus);
      setFrames(nextFrames);
      setRevealedMovie(nextRevealed);
      if (nextStatus !== "PLAYING") setShowResult(true);
      const stat = {
        status: nextStatus,
        attempts: nextGuesses.length,
        movieGuesses: nextGuesses,
        revealedFrames: nextFrames,
        revealedMovie: nextRevealed ?? undefined,
        attemptsToken: nextToken,
      };
      setGameStat(gameId, stat, todayKey, isArsiv);
      if (nextStatus !== "PLAYING") syncFinishedGamePayload(gameId, todayKey, stat);
    },
    [gameId, todayKey, isArsiv]
  );

  const sendGuess = useCallback(
    async (entry: MovieGuessEntry) => {
      if (status !== "PLAYING" || !attemptsToken || isSubmitting) return;
      setIsSubmitting(true);

      try {
        const res = await fetch("/api/karesel/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: todayKey,
            kategori: kategoriId,
            tmdbId: entry.skipped ? null : entry.tmdbId,
            attemptsToken,
          }),
        });
        if (!res.ok) return;

        const data: GuessResponse = await res.json();
        const nextGuesses = [...movieGuesses, entry];

        if (data.answer) {
          persist(nextGuesses, data.correct ? "WON" : "LOST", data.frames ?? frames, data.answer);
        } else if (data.attemptsToken) {
          // Tahminden SONRA sunucunun yeni imzaladığı token geçerli — saklanan eski
          // token değil (o sadece sayfa açılışında devam etmek için).
          setAttemptsToken(data.attemptsToken);
          persist(nextGuesses, "PLAYING", data.frames ?? frames, null, data.attemptsToken);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [status, attemptsToken, isSubmitting, movieGuesses, frames, todayKey, kategoriId, persist]
  );

  const submitGuess = useCallback(
    (movie: MovieResult) =>
      sendGuess({ skipped: false, title: movie.title, year: movie.year, tmdbId: movie.tmdbId }),
    [sendGuess]
  );
  const skip = useCallback(() => sendGuess({ skipped: true }), [sendGuess]);
  const dismissResult = useCallback(() => setShowResult(false), []);
  const openResult = useCallback(() => setShowResult(true), []);

  // Oynarken sadece en son açılan kare gösterilir; oyun bitince tüm kareler
  // galeri gibi gezilebilir (ResultModal/şerit).
  const currentFrameIndex = Math.min(movieGuesses.length, frames.length - 1);

  return {
    loading,
    notFound,
    status,
    frames,
    currentFrameIndex,
    guessRows: movieGuesses,
    revealedMovie,
    maxAttempts: MAX_ATTEMPTS,
    submitGuess,
    skip,
    isSubmitting,
    showResult,
    dismissResult,
    openResult,
  };
}

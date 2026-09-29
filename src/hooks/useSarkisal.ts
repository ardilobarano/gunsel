"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSarkisalGameId, MAX_ATTEMPTS, STAGE_SECONDS, type SpotifyTrackResult } from "@/lib/sarkisal";
import { getGameStat, setGameStat, syncFinishedGamePayload } from "@/lib/storage";
import type { GameStatus, SongGuessEntry } from "@/lib/types";
import { getTodayKey } from "@/lib/utils";

interface Challenge {
  audioUrl: string;
  attemptsToken: string;
}

interface RevealedAnswer {
  title: string;
  artist: string;
}

export function useSarkisal(categoryId: string, arsivTarihi?: string) {
  const todayKey = useMemo(() => arsivTarihi ?? getTodayKey(), [arsivTarihi]);
  /* Arşiv modunda sonuç AYRI alana yazılır: aynı yere yazsaydı geçmiş günleri
     sırayla oynayan biri kendine geriye dönük seri üretebilirdi (bkz. storage.ts). */
  const isArsiv = !!arsivTarihi;
  const gameId = useMemo(() => getSarkisalGameId(categoryId), [categoryId]);

  const [songGuesses, setSongGuesses] = useState<SongGuessEntry[]>(
    () => getGameStat(gameId, todayKey, isArsiv)?.songGuesses ?? []
  );
  const [status, setStatus] = useState<GameStatus>(() => getGameStat(gameId, todayKey, isArsiv)?.status ?? "PLAYING");
  const [revealedAnswer, setRevealedAnswer] = useState<RevealedAnswer | null>(
    () => getGameStat(gameId, todayKey, isArsiv)?.revealedAnswer ?? null
  );

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Devam etme: sunucunun EN SON İMZALADIĞI token. Tahmin sayısını /challenge'a
     bildirmek cevabı iki istekte sızdıran bir açıktı (bkz. challenge route). */
  const [storedToken] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.attemptsToken);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/sarkisal/challenge?date=${todayKey}&categoryId=${categoryId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Challenge | null) => {
        if (cancelled) return;
        if (data) setChallenge(storedToken ? { ...data, attemptsToken: storedToken } : data);
        else setNotFound(true);
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
  }, [todayKey, categoryId, storedToken]);

  const stageIndex = Math.min(songGuesses.length, MAX_ATTEMPTS - 1);
  const maxSeconds = STAGE_SECONDS[stageIndex];

  const persist = useCallback(
    (nextGuesses: SongGuessEntry[], nextStatus: GameStatus, nextRevealed: RevealedAnswer | null, nextToken?: string) => {
      setSongGuesses(nextGuesses);
      setStatus(nextStatus);
      setRevealedAnswer(nextRevealed);
      if (nextStatus !== "PLAYING") setShowResult(true);
      const stat = {
        status: nextStatus,
        attempts: nextGuesses.length,
        songGuesses: nextGuesses,
        revealedAnswer: nextRevealed ?? undefined,
        attemptsToken: nextToken,
      };
      setGameStat(gameId, stat, todayKey, isArsiv);
      if (nextStatus !== "PLAYING") syncFinishedGamePayload(gameId, todayKey, stat);
    },
    [gameId, todayKey, isArsiv]
  );

  const sendGuess = useCallback(
    async (entry: SongGuessEntry) => {
      if (status !== "PLAYING" || !challenge || isSubmitting) return;
      setIsSubmitting(true);

      try {
        const res = await fetch("/api/sarkisal/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: todayKey,
            categoryId,
            spotifyTrackId: entry.skipped ? null : entry.spotifyTrackId,
            artist: entry.skipped ? null : entry.artist,
            attemptsToken: challenge.attemptsToken,
          }),
        });
        if (!res.ok) return;

        const data: { correct: boolean; artistMatch?: boolean; answer?: RevealedAnswer; attemptsToken?: string } =
          await res.json();
        const nextGuesses = [...songGuesses, { ...entry, artistMatch: data.artistMatch }];

        if (data.answer) {
          persist(nextGuesses, data.correct ? "WON" : "LOST", data.answer);
        } else if (data.attemptsToken) {
          setChallenge({ ...challenge, attemptsToken: data.attemptsToken });
          persist(nextGuesses, "PLAYING", null, data.attemptsToken);
        }

        // Hızlı art arda tıklamada (özellikle Pas Geç) çakışan istekleri önlemek için küçük bir bekleme.
        await new Promise((resolve) => setTimeout(resolve, 400));
      } finally {
        setIsSubmitting(false);
      }
    },
    [status, challenge, isSubmitting, songGuesses, todayKey, categoryId, persist]
  );

  const submitGuess = useCallback(
    (song: SpotifyTrackResult) =>
      sendGuess({ skipped: false, title: song.title, artist: song.artist, spotifyTrackId: song.id }),
    [sendGuess]
  );
  const skip = useCallback(() => sendGuess({ skipped: true }), [sendGuess]);
  const dismissResult = useCallback(() => setShowResult(false), []);
  const openResult = useCallback(() => setShowResult(true), []);

  const guessRows = songGuesses.map((entry) => ({
    skipped: entry.skipped,
    title: entry.title,
    artist: entry.artist,
    artistMatch: entry.artistMatch,
  }));

  return {
    audioUrl: challenge?.audioUrl,
    loading,
    notFound,
    status,
    guessRows,
    revealedAnswer,
    stageIndex,
    maxSeconds,
    maxAttempts: MAX_ATTEMPTS,
    submitGuess,
    skip,
    isSubmitting,
    showResult,
    dismissResult,
    openResult,
  };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMPLETION_RANK_LABEL,
  ERROR_MESSAGES,
  GAME_ID,
  RANKS,
  getDailyPuzzle,
  getMaxScore,
  getRank,
  scoreForWord,
  validateWord,
} from "@/lib/harfBahcesi";
import { getGameStat, setGameStat } from "@/lib/storage";
import type { GameStatus } from "@/lib/types";
import { getTodayKey, trUpper } from "@/lib/utils";

export function useHarfBahcesi(arsivTarihi?: string) {
  const todayKey = useMemo(() => arsivTarihi ?? getTodayKey(), [arsivTarihi]);
  /* Arşiv modunda sonuç AYRI alana yazılır: aynı yere yazsaydı geçmiş günleri
     sırayla oynayan biri kendine geriye dönük seri üretebilirdi (bkz. storage.ts). */
  const isArsiv = !!arsivTarihi;
  const puzzle = useMemo(() => getDailyPuzzle(todayKey), [todayKey]);
  const maxScore = useMemo(() => getMaxScore(puzzle), [puzzle]);

  const [foundWords, setFoundWords] = useState<string[]>(
    () => getGameStat(GAME_ID, todayKey, isArsiv)?.guesses ?? []
  );
  const [currentWord, setCurrentWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeToken, setShakeToken] = useState(0);
  const [lastPangram, setLastPangram] = useState<string | null>(null);

  const score = foundWords.reduce((sum, w) => sum + scoreForWord(w, puzzle), 0);
  const rank = getRank(score, maxScore);
  const completionRankIndex = RANKS.findIndex((r) => r.label === COMPLETION_RANK_LABEL);
  const status: GameStatus = rank.index >= completionRankIndex ? "WON" : "PLAYING";

  const addLetter = useCallback(
    (letter: string) => {
      if (!puzzle.letters.includes(letter)) return;
      setError(null);
      setCurrentWord((prev) => prev + letter);
    },
    [puzzle.letters]
  );

  const removeLetter = useCallback(() => {
    setError(null);
    setCurrentWord((prev) => prev.slice(0, -1));
  }, []);

  const clearWord = useCallback(() => {
    setError(null);
    setCurrentWord("");
  }, []);

  const submitWord = useCallback(() => {
    const word = trUpper(currentWord);
    const result = validateWord(word, puzzle, foundWords);

    if (!result.ok) {
      setError(ERROR_MESSAGES[result.error]);
      setShakeToken((t) => t + 1);
      return;
    }

    const nextFoundWords = [...foundWords, word];
    setFoundWords(nextFoundWords);
    setCurrentWord("");
    setError(null);

    if (puzzle.pangrams.includes(word)) {
      setLastPangram(word);
      setTimeout(() => setLastPangram(null), 2500);
    }

    const nextScore = nextFoundWords.reduce((sum, w) => sum + scoreForWord(w, puzzle), 0);
    const nextRank = getRank(nextScore, maxScore);
    const nextStatus: GameStatus = nextRank.index >= completionRankIndex ? "WON" : "PLAYING";

    setGameStat(
      GAME_ID,
      { status: nextStatus, attempts: nextFoundWords.length, guesses: nextFoundWords },
      todayKey,
      isArsiv
    );
  }, [currentWord, puzzle, foundWords, maxScore, completionRankIndex, todayKey, isArsiv]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        submitWord();
        return;
      }
      if (event.key === "Backspace") {
        removeLetter();
        return;
      }
      if (event.key.length === 1) {
        addLetter(trUpper(event.key));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitWord, removeLetter, addLetter]);

  return {
    puzzle,
    foundWords,
    currentWord,
    error,
    shakeToken,
    lastPangram,
    score,
    maxScore,
    rank,
    status,
    addLetter,
    removeLetter,
    clearWord,
    submitWord,
  };
}

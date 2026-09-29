"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CUSTOM_STORAGE_DATE,
  getKelimeselOzelGameId,
  isTurkishLetter,
  mergeKeyboardStatus,
  type LetterStatus,
} from "@/lib/kelimesel";
import { getGameStat, setGameStat } from "@/lib/storage";
import { preloadSounds } from "@/lib/sound";
import type { CustomWordRecord, GameStatus } from "@/lib/types";
import { trUpper } from "@/lib/utils";

type CustomMode = "normal" | "hard";

interface Challenge {
  wordIndex: number;
  wordLength: number;
  wordCount: number;
  maxGuesses: number;
  timeLimitSeconds: number | null;
  dictionaryEnabled: boolean;
  mode: CustomMode;
  startedAt: number;
  attemptsToken: string;
}

interface GuessResponse {
  valid: boolean;
  timeUp?: boolean;
  evaluation?: LetterStatus[];
  status?: "PLAYING" | "NEXT_WORD" | "WORD_LOST" | "WON" | "LOST";
  wordIndex?: number;
  wordLength?: number;
  attemptsToken?: string;
  /** WORD_LOST: sadece BU kelimenin cevabı (bulmaca devam ediyor). */
  revealedWord?: string;
  /** LOST (son kelime/süre bitti): kalan kelime(ler). */
  revealedWords?: string[];
}

interface NextWordInfo {
  wordIndex: number;
  wordLength: number;
  attemptsToken: string;
}

/** Standart Wordle hard mode: yeşil harfler aynı yerde tekrar edilmeli, sarı harfler
 * tahminde bir yerde geçmeli. Sadece bir önceki tahmine bakmak yeterli çünkü her
 * geçerli tahmin zaten bir öncekinin ipuçlarını koruyor. Bu istemci tarafında
 * uygulanıyor — gerçek Wordle'ın hard mode'u da öyle, korunacak bir "cevap" yok,
 * oyuncunun kendi kendine koyduğu bir kısıtlama. */
function checkHardMode(guess: string, previousGuesses: string[], previousEvaluations: LetterStatus[][]): string | null {
  if (previousGuesses.length === 0) return null;
  const lastGuess = previousGuesses[previousGuesses.length - 1];
  const lastEvaluation = previousEvaluations[previousEvaluations.length - 1];

  for (let i = 0; i < lastEvaluation.length; i++) {
    if (lastEvaluation[i] === "correct" && guess[i] !== lastGuess[i]) {
      return `${i + 1}. harf ${lastGuess[i]} olmalı`;
    }
  }
  const usedLetters = new Set(guess.split(""));
  for (let i = 0; i < lastEvaluation.length; i++) {
    if (lastEvaluation[i] === "present" && !usedLetters.has(lastGuess[i])) {
      return `Tahmininde ${lastGuess[i]} harfi olmalı`;
    }
  }
  return null;
}

export function useKelimeselOzel(shareCode: string) {
  const gameId = useMemo(() => getKelimeselOzelGameId(shareCode), [shareCode]);
  const stored = useMemo(() => getGameStat(gameId, CUSTOM_STORAGE_DATE), [gameId]);

  const [guesses, setGuesses] = useState<string[]>(() => stored?.guesses ?? []);
  const [evaluations, setEvaluations] = useState<LetterStatus[][]>(() => stored?.evaluations ?? []);
  const [status, setStatus] = useState<GameStatus>(() => stored?.status ?? "PLAYING");
  const [wordIndex, setWordIndex] = useState<number>(() => stored?.customWordIndex ?? 0);
  const [viewIndex, setViewIndex] = useState<number>(() => stored?.customWordIndex ?? 0);
  const [wordRecords, setWordRecords] = useState<CustomWordRecord[]>(() => stored?.customWordRecords ?? []);
  const [revealedWords, setRevealedWords] = useState<string[] | null>(() => stored?.customRevealedWords ?? null);
  const [startedAt, setStartedAt] = useState<number | undefined>(() => stored?.customStartedAt);

  // Bir kelime bitince (doğru ya da deneme hakkı biterek) ama sırada başka kelime
  // varsa: hemen sonraki kelimeye geçmek yerine önce bir sonuç popup'ı gösteriyoruz.
  // Kullanıcı "Devam" deyince nextWord'daki bilgiyle asıl geçiş yapılıyor.
  const [pendingAdvance, setPendingAdvance] = useState<{ won: boolean; word: string } | null>(null);
  const [nextWord, setNextWord] = useState<NextWordInfo | null>(null);

  const [currentGuess, setCurrentGuess] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeToken, setShakeToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Mount anında sabitlenen değerler — challenge fetch'i sadece ilk mount'ta bir kez
  // çalışsın diye (bkz. günlük Kelimesel'deki initialAttempts deseni).
  const [initialWordIndex] = useState(() => stored?.customWordIndex ?? 0);
  const [initialAttempts] = useState(() => stored?.guesses?.length ?? 0);
  const [initialStartedAt] = useState(() => stored?.customStartedAt);
  /* Devam etmenin tek meşru yolu: sunucunun EN SON İMZALADIĞI token. İlerlemeyi
     /challenge'a parametre olarak bildirmek cevabı sızdıran bir açıktı. */
  const [storedToken] = useState(() => stored?.attemptsToken);

  useEffect(() => {
    preloadSounds();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ wordIndex: String(initialWordIndex) });

    fetch(`/api/kelimesel/ozel/${shareCode}/challenge?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Challenge | null) => {
        if (cancelled) return;
        /* Saklanan token devam etmenin tek yolu. startedAt de yerelden alınıyor ama
           SADECE GÖSTERİM için: gerçek süre denetimi token'ın içindeki damgaya bakıyor,
           sunucu artık istemcinin bildirdiği zamanı kabul etmiyor. Bu olmasaydı sayfa
           yenilenince geri sayım görsel olarak sıfırlanmış görünürdü. */
        if (data && storedToken) {
          data = { ...data, attemptsToken: storedToken, startedAt: initialStartedAt ?? data.startedAt };
        }
        if (data) {
          setChallenge(data);
          setStartedAt(data.startedAt);
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
  }, [shareCode, initialWordIndex, storedToken, initialStartedAt]);

  const triggerShake = useCallback((message: string) => {
    setError(message);
    setShakeToken((token) => token + 1);
  }, []);

  const isViewingActive = viewIndex === wordIndex;

  const addLetter = useCallback(
    (letter: string) => {
      if (status !== "PLAYING" || !challenge || !isViewingActive || pendingAdvance) return;
      setError(null);
      // Fonksiyonel güncelleme: currentGuess'i closure'dan değil her zaman en güncel
      // state'ten okur — hızlı art arda tuş/tık gelirse closure'daki eski değere göre
      // üzerine yazıp harf kaybetmeyi önler (bkz. useKelimesel.ts'teki aynı düzeltme).
      const wordLength = challenge.wordLength;
      setCurrentGuess((prev) => (prev.length < wordLength ? prev + letter : prev));
    },
    [status, challenge, isViewingActive, pendingAdvance]
  );

  const removeLetter = useCallback(() => {
    if (status !== "PLAYING" || !isViewingActive || pendingAdvance) return;
    setError(null);
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [status, isViewingActive, pendingAdvance]);

  const persist = useCallback(
    (
      nextGuesses: string[],
      nextEvaluations: LetterStatus[][],
      nextStatus: GameStatus,
      nextWordIndex: number,
      nextRevealedWords: string[] | null,
      nextWordRecords: CustomWordRecord[],
      nextToken?: string
    ) => {
      setGuesses(nextGuesses);
      setEvaluations(nextEvaluations);
      setStatus(nextStatus);
      setWordIndex(nextWordIndex);
      setViewIndex(nextWordIndex);
      setRevealedWords(nextRevealedWords);
      setWordRecords(nextWordRecords);
      if (nextStatus !== "PLAYING") setShowResult(true);
      setGameStat(
        gameId,
        {
          status: nextStatus,
          attempts: nextGuesses.length,
          guesses: nextGuesses,
          evaluations: nextEvaluations,
          customWordIndex: nextWordIndex,
          customStartedAt: startedAt,
          customRevealedWords: nextRevealedWords ?? undefined,
          customWordRecords: nextWordRecords,
          /* Devam etmenin tek yolu bu — sunucu artık ilerlemeyi istemciden almıyor. */
          attemptsToken: nextToken,
        },
        CUSTOM_STORAGE_DATE
      );
    },
    [gameId, startedAt]
  );

  const submitGuess = useCallback(async () => {
    if (status !== "PLAYING" || !challenge || submitting || !isViewingActive || pendingAdvance) return;

    if (currentGuess.length !== challenge.wordLength) {
      triggerShake("Yetersiz harf sayısı");
      return;
    }
    // Sözlük kontrolü sunucuda (bkz. kelimeselDictionary.server.ts) — kelime listesi
    // artık client'a gönderilmiyor. Zor mod kontrolü client'ta kalıyor: o zaten
    // oyuncunun kendine koyduğu bir kısıt, gizlenecek veri içermiyor.
    if (challenge.mode === "hard") {
      const hardModeError = checkHardMode(trUpper(currentGuess), guesses, evaluations);
      if (hardModeError) {
        triggerShake(hardModeError);
        return;
      }
    }

    const guess = trUpper(currentGuess);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/kelimesel/ozel/${shareCode}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess, attemptsToken: challenge.attemptsToken }),
      });
      if (!res.ok) return;

      const data: GuessResponse = await res.json();

      if (!data.valid) {
        triggerShake("Kelime listede yok");
        return;
      }

      if (data.timeUp) {
        setCurrentGuess("");
        persist(guesses, evaluations, "LOST", wordIndex, data.revealedWords ?? null, wordRecords);
        return;
      }
      if (!data.evaluation) return;

      const nextGuesses = [...guesses, guess];
      const nextEvaluations = [...evaluations, data.evaluation];
      setCurrentGuess("");
      setError(null);

      if (data.status === "WON") {
        // Son kelime de doğru bilindi — tüm bulmaca bitti, normal sonuç ekranı açılır.
        const finishedRecords = [...wordRecords];
        finishedRecords[wordIndex] = { guesses: nextGuesses, evaluations: nextEvaluations, status: "WON", revealedWord: null };
        persist(nextGuesses, nextEvaluations, "WON", wordIndex, null, finishedRecords);
        return;
      }

      if (data.status === "NEXT_WORD" && data.attemptsToken && typeof data.wordIndex === "number") {
        // Bu kelime doğru ama sırada başka kelime var — hemen geçmeden önce popup göster.
        const finishedRecords = [...wordRecords];
        finishedRecords[wordIndex] = { guesses: nextGuesses, evaluations: nextEvaluations, status: "WON", revealedWord: null };
        persist(nextGuesses, nextEvaluations, "PLAYING", wordIndex, null, finishedRecords, data.attemptsToken);
        setPendingAdvance({ won: true, word: guess });
        setNextWord({
          wordIndex: data.wordIndex,
          wordLength: data.wordLength ?? challenge.wordLength,
          attemptsToken: data.attemptsToken,
        });
        return;
      }

      if (data.status === "WORD_LOST" && data.attemptsToken && typeof data.wordIndex === "number") {
        // Bu kelimede deneme hakkı bitti ama sırada başka kelime var — tüm bulmacayı
        // BİTİRMİYORUZ, sadece bu kelimenin cevabını açıklayan bir popup gösterip devam ediyoruz.
        const finishedRecords = [...wordRecords];
        finishedRecords[wordIndex] = {
          guesses: nextGuesses,
          evaluations: nextEvaluations,
          status: "LOST",
          revealedWord: data.revealedWord ?? null,
        };
        persist(nextGuesses, nextEvaluations, "PLAYING", wordIndex, null, finishedRecords, data.attemptsToken);
        setPendingAdvance({ won: false, word: data.revealedWord ?? "" });
        setNextWord({
          wordIndex: data.wordIndex,
          wordLength: data.wordLength ?? challenge.wordLength,
          attemptsToken: data.attemptsToken,
        });
        return;
      }

      if (data.status === "LOST") {
        const finishedRecords = [...wordRecords];
        finishedRecords[wordIndex] = {
          guesses: nextGuesses,
          evaluations: nextEvaluations,
          status: "LOST",
          revealedWord: data.revealedWords?.[0] ?? null,
        };
        persist(nextGuesses, nextEvaluations, "LOST", wordIndex, data.revealedWords ?? null, finishedRecords);
        return;
      }

      if (data.status === "PLAYING" && data.attemptsToken) {
        setChallenge({ ...challenge, attemptsToken: data.attemptsToken });
        persist(nextGuesses, nextEvaluations, "PLAYING", wordIndex, null, wordRecords, data.attemptsToken);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    status,
    challenge,
    submitting,
    isViewingActive,
    pendingAdvance,
    currentGuess,
    guesses,
    evaluations,
    wordIndex,
    wordRecords,
    shareCode,
    persist,
    triggerShake,
  ]);

  /** Ara sonuç popup'ındaki "Devam" — asıl kelime geçişini burada uyguluyoruz. */
  const continueToNextWord = useCallback(() => {
    if (!pendingAdvance || !nextWord) return;
    setChallenge((prev) =>
      prev ? { ...prev, wordIndex: nextWord.wordIndex, wordLength: nextWord.wordLength, attemptsToken: nextWord.attemptsToken } : prev
    );
    setPendingAdvance(null);
    const targetIndex = nextWord.wordIndex;
    setNextWord(null);
    persist([], [], "PLAYING", targetIndex, null, wordRecords, nextWord.attemptsToken);
  }, [pendingAdvance, nextWord, wordRecords, persist]);

  const dismissResult = useCallback(() => setShowResult(false), []);
  const openResult = useCallback(() => setShowResult(true), []);

  /** Kelimeler arası gezinme (Stepper) — sadece zaten ulaşılmış kelimelere (0..wordIndex)
   * bakmaya izin verir, ileride henüz açılmamış bir kelimeye atlanamaz. */
  const viewWord = useCallback(
    (index: number) => {
      setViewIndex(Math.max(0, Math.min(index, wordIndex)));
    },
    [wordIndex]
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        void submitGuess();
        return;
      }
      if (event.key === "Backspace") {
        removeLetter();
        return;
      }
      if (event.key.length === 1) {
        const letter = trUpper(event.key);
        if (isTurkishLetter(letter)) addLetter(letter);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitGuess, removeLetter, addLetter]);

  const viewedRecord = !isViewingActive ? wordRecords[viewIndex] : undefined;
  const displayGuesses = useMemo(
    () => (isViewingActive ? guesses : (viewedRecord?.guesses ?? [])),
    [isViewingActive, guesses, viewedRecord]
  );
  const displayEvaluations = useMemo(
    () => (isViewingActive ? evaluations : (viewedRecord?.evaluations ?? [])),
    [isViewingActive, evaluations, viewedRecord]
  );
  const displayCurrentGuess = isViewingActive ? currentGuess : "";
  const displayWordLength = isViewingActive ? (challenge?.wordLength ?? 0) : (viewedRecord?.guesses[0]?.length ?? 0);
  const displayInitialGuessCount = isViewingActive ? initialAttempts : displayGuesses.length;
  const displayRevealedWord = isViewingActive
    ? (revealedWords?.[0] ?? null)
    : (viewedRecord?.revealedWord ?? null);

  const keyboardStatuses = useMemo(() => {
    return displayEvaluations.reduce<Record<string, LetterStatus>>((acc, evaluation, guessIndex) => {
      const guess = displayGuesses[guessIndex];
      evaluation.forEach((letterStatus, i) => {
        const letter = guess[i];
        acc[letter] = mergeKeyboardStatus(acc[letter], letterStatus);
      });
      return acc;
    }, {});
  }, [displayEvaluations, displayGuesses]);

  return {
    loading,
    notFound,
    wordIndex,
    viewIndex,
    isViewingActive,
    wordLength: displayWordLength,
    wordCount: challenge?.wordCount ?? 1,
    maxGuesses: challenge?.maxGuesses ?? 6,
    timeLimitSeconds: challenge?.timeLimitSeconds ?? null,
    mode: challenge?.mode ?? "normal",
    startedAt,
    revealedWords,
    revealedWord: displayRevealedWord,
    guesses: displayGuesses,
    evaluations: displayEvaluations,
    initialGuessCount: displayInitialGuessCount,
    currentGuess: displayCurrentGuess,
    status,
    error,
    shakeToken,
    keyboardStatuses,
    showResult,
    dismissResult,
    openResult,
    addLetter,
    removeLetter,
    submitGuess,
    pendingAdvance,
    continueToNextWord,
    viewWord,
  };
}

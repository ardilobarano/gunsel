"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMaxAttempts,
  getKelimeselGameId,
  isTurkishLetter,
  mergeKeyboardStatus,
  type LetterStatus,
  type WordLength,
} from "@/lib/kelimesel";
import { getGameStat, setGameStat, syncFinishedGamePayload } from "@/lib/storage";
import { preloadSounds } from "@/lib/sound";
import type { GameStatus } from "@/lib/types";
import { getTodayKey, trUpper } from "@/lib/utils";

/**
 * Harf çevirme animasyonu bittikten sonra sonuç ekranı açılana kadar geçen süre.
 *
 * 1.500 ms idi, 1.000'e indirildi: 5 harfte animasyonun kendisi 1,1 saniye
 * sürdüğü için toplam bekleme 2,6 saniyeyi buluyordu ve doğru cevabı verdikten
 * sonra ekranda beklemek uzun geliyordu (kullanıcı bildirdi). Sıfırlanmıyor,
 * çünkü tamamlanmış tahtayı görmeden modal açılırsa son satır kaçıyor.
 */
const BEKLEME_MS = 1000;

interface Challenge {
  attemptsToken: string;
}

interface GuessResponse {
  valid: boolean;
  evaluation?: LetterStatus[];
  status?: GameStatus;
  attemptsToken?: string;
  revealedWord?: string;
}

export function useKelimesel(length: WordLength, arsivTarihi?: string) {
  const todayKey = useMemo(() => arsivTarihi ?? getTodayKey(), [arsivTarihi]);
  /* Arşiv modunda sonuç AYRI alana yazılır: aynı yere yazsaydı geçmiş günleri
     sırayla oynayan biri kendine geriye dönük seri üretebilirdi (bkz. storage.ts). */
  const isArsiv = !!arsivTarihi;
  const gameId = useMemo(() => getKelimeselGameId(length), [length]);
  const maxAttempts = getMaxAttempts();

  const [guesses, setGuesses] = useState<string[]>(() => getGameStat(gameId, todayKey, isArsiv)?.guesses ?? []);
  const [evaluations, setEvaluations] = useState<LetterStatus[][]>(
    () => getGameStat(gameId, todayKey, isArsiv)?.evaluations ?? []
  );
  const [status, setStatus] = useState<GameStatus>(() => getGameStat(gameId, todayKey, isArsiv)?.status ?? "PLAYING");
  const [revealedWord, setRevealedWord] = useState<string | null>(
    () => getGameStat(gameId, todayKey, isArsiv)?.revealedWord ?? null
  );

  const [currentGuess, setCurrentGuess] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeToken, setShakeToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showResult, setShowResult] = useState(false);
  /* Gecikmeli sonuç ekranının zamanlayıcısı. Ref'te tutuluyor ki harf uzunluğu
     değiştirilip bileşen remount edildiğinde ya da sayfadan çıkıldığında
     temizlenebilsin — yoksa modal, oyuncu başka bir uzunluğa geçtikten sonra
     açılırdı. */
  const sonucZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (sonucZamanlayici.current) clearTimeout(sonucZamanlayici.current);
    },
    [],
  );

  /* Yarım kalan oyuna devam: sunucunun EN SON İMZALADIĞI token'ı kullanıyoruz.
     Eskiden bunun yerine tahmin sayısı /challenge'a parametre olarak bildiriliyordu;
     bu, cevabı iki istekte sızdıran bir açıktı (bkz. api/kelimesel/challenge). */
  const [storedToken] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.attemptsToken);
  /* Başka bir cihazda bitirilip StatsSync ile birleştirilen bir gün: guesses/evaluations
     hiç senkron edilmiyor (yalnızca özet — status + attempts — sunucuya gidiyor), o
     yüzden guesses.length burada 0 kalır. attempts alanına düşmek "0 adımda çözüldü"
     gibi yanlış bir sonuç göstermek yerine gerçek sayıyı kullanmasını sağlıyor. */
  const [initialAttempts] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.attempts ?? 0);
  const [initialGuessCount] = useState(
    () => getGameStat(gameId, todayKey, isArsiv)?.guesses?.length ?? initialAttempts
  );

  useEffect(() => {
    preloadSounds();
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/kelimesel/challenge?date=${todayKey}&length=${length}`)
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
  }, [todayKey, length, storedToken]);

  const triggerShake = useCallback((message: string) => {
    setError(message);
    setShakeToken((token) => token + 1);
  }, []);

  const addLetter = useCallback(
    (letter: string) => {
      if (status !== "PLAYING") return;
      setError(null);
      // Fonksiyonel güncelleme: currentGuess'i closure'dan değil her zaman en güncel
      // state'ten okur — hızlı art arda tuş/tık gelirse (fiziksel klavyede hızlı
      // yazmak ya da ekran klavyesine art arda tıklamak) closure'daki eski değere
      // göre üzerine yazıp harf kaybetmeyi önler.
      setCurrentGuess((prev) => (prev.length < length ? prev + letter : prev));
    },
    [status, length]
  );

  const removeLetter = useCallback(() => {
    if (status !== "PLAYING") return;
    setError(null);
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [status]);

  const persist = useCallback(
    (
      nextGuesses: string[],
      nextEvaluations: LetterStatus[][],
      nextStatus: GameStatus,
      nextRevealedWord: string | null,
      nextToken?: string
    ) => {
      setGuesses(nextGuesses);
      setEvaluations(nextEvaluations);
      setStatus(nextStatus);
      setRevealedWord(nextRevealedWord);
      /* Sonuç ekranı HEMEN açılmıyor: oyuncu son satırın çevrilişini ve
         tamamlanmış tahtayı görebilsin diye bekliyor. Bekleme, harflerin
         çevirme animasyonu BİTTİKTEN SONRA başlıyor.
         Animasyon süresi kelime uzunluğuna bağlı (WordGrid: harf başına 0,2 sn
         gecikme + 0,3 sn süre), o yüzden sabit sayı yazılmıyor — 8 harfte 1,7
         saniye sürüyor, sabit değer kısa kelimede geç, uzun kelimede erken
         açardı. */
      if (nextStatus !== "PLAYING") {
        const animasyonMs = (length - 1) * 200 + 300;
        if (sonucZamanlayici.current) clearTimeout(sonucZamanlayici.current);
        sonucZamanlayici.current = setTimeout(
          () => setShowResult(true),
          animasyonMs + BEKLEME_MS,
        );
      }
      const stat = {
        status: nextStatus,
        attempts: nextGuesses.length,
        guesses: nextGuesses,
        evaluations: nextEvaluations,
        revealedWord: nextRevealedWord ?? undefined,
        attemptsToken: nextToken,
      };
      setGameStat(gameId, stat, todayKey, isArsiv);
      // Başka cihazda da aynı tahta + cevap görünsün diye anında sunucuya ekleniyor
      // (bkz. syncFinishedGamePayload) — sadece giriş yapılmışsa satır bulunup
      // güncellenir, yoksa istek sessizce yutulur.
      if (nextStatus !== "PLAYING") syncFinishedGamePayload(gameId, todayKey, stat);
    },
    [gameId, todayKey, isArsiv, length]
  );

  const submitGuess = useCallback(async () => {
    if (status !== "PLAYING" || !challenge || submitting) return;

    if (currentGuess.length !== length) {
      triggerShake("Yetersiz harf sayısı");
      return;
    }

    // Sözlük kontrolü burada YAPILMIYOR — kelime listesi artık client'a gönderilmiyor
    // (bkz. kelimeselDictionary.server.ts). Sunucu geçersiz kelimeye {valid:false}
    // dönüyor ve aşağıda aynı "Kelime listede yok" uyarısı gösteriliyor; geçersiz
    // tahmin deneme hakkı harcamıyor.
    const guess = trUpper(currentGuess);
    setSubmitting(true);

    try {
      const res = await fetch("/api/kelimesel/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayKey, length, guess, attemptsToken: challenge.attemptsToken }),
      });
      if (!res.ok) return;

      const data: GuessResponse = await res.json();

      if (!data.valid || !data.evaluation) {
        triggerShake("Kelime listede yok");
        return;
      }

      const nextGuesses = [...guesses, guess];
      const nextEvaluations = [...evaluations, data.evaluation];
      setCurrentGuess("");
      setError(null);

      if (data.status === "PLAYING" && data.attemptsToken) {
        setChallenge({ attemptsToken: data.attemptsToken });
        persist(nextGuesses, nextEvaluations, "PLAYING", null, data.attemptsToken);
      } else if (data.status === "WON" || data.status === "LOST") {
        persist(nextGuesses, nextEvaluations, data.status, data.revealedWord ?? null);
      }
    } finally {
      setSubmitting(false);
    }
  }, [status, challenge, submitting, currentGuess, length, guesses, evaluations, todayKey, persist, triggerShake]);

  const dismissResult = useCallback(() => setShowResult(false), []);
  const openResult = useCallback(() => setShowResult(true), []);

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

  const keyboardStatuses = useMemo(() => {
    return evaluations.reduce<Record<string, LetterStatus>>((acc, evaluation, guessIndex) => {
      const guess = guesses[guessIndex];
      evaluation.forEach((letterStatus, i) => {
        const letter = guess[i];
        acc[letter] = mergeKeyboardStatus(acc[letter], letterStatus);
      });
      return acc;
    }, {});
  }, [evaluations, guesses]);

  return {
    loading,
    notFound,
    todayKey,
    revealedWord,
    maxAttempts,
    guesses,
    evaluations,
    /* Mount anındaki tahmin sayısı — sadece animasyonun zaten dolu satırları
       tekrar oynatmaması için (bkz. WordGrid). */
    initialGuessCount: initialGuessCount,
    /* Depodaki gerçek tahmin sayısı — başka cihazda bitirilmiş bir gün için
       guesses/evaluations boş kalabildiğinden (bkz. initialAttempts tanımı),
       ResultModal bunu "X adımda çözüldü" için evaluations.length'e yedek olarak kullanır. */
    initialAttempts,
    currentGuess,
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
  };
}

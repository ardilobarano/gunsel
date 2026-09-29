"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COUNT_UP_MS, getDahaAzCokGameId, MAX_STEPS, OUTCOME_HOLD_MS, type GuessDirection } from "@/lib/dahaAzCok";
import { getGameStat, setGameStat, syncFinishedGamePayload } from "@/lib/storage";
import type { GameStatus } from "@/lib/types";
import { getTodayKey } from "@/lib/utils";

interface Item {
  id: string;
  label: string;
  value: number;
  unit: string;
  imageUrl?: string | null;
}

interface NextItem {
  id: string;
  label: string;
  unit: string;
  imageUrl?: string | null;
}

export interface RevealableItem {
  id: string;
  label: string;
  unit: string;
  value?: number;
  imageUrl?: string | null;
}

interface ChallengeResponse {
  stepIndex: number;
  correctCount: number;
  revealedItems: Item[];
  nextItem: NextItem;
  attemptsToken: string;
}

interface GuessResponse {
  correct: boolean;
  status: "PLAYING" | "WON";
  stepIndex: number;
  correctCount: number;
  revealedItem: Item;
  nextItem?: NextItem;
  attemptsToken?: string;
}

/** Tahminden sonraki akış iki aşamalı: önce sayı 0'dan gerçek değere sayıyor (COUNT_UP_MS,
 * bu sırada renk YOK — sayı bitmeden sonucu söylemiş olmak "smooth değil" hissi veriyordu),
 * sayı durunca doğru/yanlış rengi yanıyor ve OUTCOME_HOLD_MS kadar ekranda kalıyor, ancak
 * ondan sonra yeni çifte kayılıyor. */

export function useDahaAzCok(categoryId: string, arsivTarihi?: string) {
  const todayKey = useMemo(() => arsivTarihi ?? getTodayKey(), [arsivTarihi]);
  /* Arşiv modunda sonuç AYRI alana yazılır: aynı yere yazsaydı geçmiş günleri
     sırayla oynayan biri kendine geriye dönük seri üretebilirdi (bkz. storage.ts). */
  const isArsiv = !!arsivTarihi;
  const gameId = useMemo(() => getDahaAzCokGameId(categoryId), [categoryId]);

  const [revealedItems, setRevealedItems] = useState<Item[]>(
    () => getGameStat(gameId, todayKey, isArsiv)?.dahaAzCokRevealedItems ?? []
  );
  const [roundResults, setRoundResults] = useState<boolean[]>(
    () => getGameStat(gameId, todayKey, isArsiv)?.dahaAzCokRoundResults ?? []
  );
  const [status, setStatus] = useState<GameStatus>(() => getGameStat(gameId, todayKey, isArsiv)?.status ?? "PLAYING");

  const [nextItem, setNextItem] = useState<NextItem | null>(null);
  const [attemptsToken, setAttemptsToken] = useState<string | null>(null);
  // Oyun sayfa açılırken zaten bitmişse (status !== "PLAYING") /challenge hiç çağrılmayacak
  // (bkz. aşağıdaki initialStatus/effect) — o yüzden "loading" da baştan false başlıyor,
  // effect içinde senkron setLoading(false) çağırmaya (react-hooks/set-state-in-effect
  // kuralına takılır) gerek kalmıyor.
  const [loading, setLoading] = useState(() => (getGameStat(gameId, todayKey, isArsiv)?.status ?? "PLAYING") === "PLAYING");
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // submitting state'i render'ı bekliyor — art arda çok hızlı gelen iki tıklama/dokunuş
  // (özellikle dokunmatik ekranda) React henüz butonu disabled yapmadan ikinci bir
  // isteği tetikleyip bir turun sayılmasını atlayabiliyordu. Ref senkron olduğu için
  // bu pencereyi tamamen kapatıyor.
  const submittingRef = useRef(false);

  // Kartın değeri açığa çıktı ama çiftler henüz kaymadı — geçiş anındaki geri bildirim.
  const [revealingValue, setRevealingValue] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  // Sayı sayma animasyonu bitip doğru/yanlış rengi yanana kadar false kalır.
  const [showOutcome, setShowOutcome] = useState(false);

  const [storedToken] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.attemptsToken);
  const [initialStepIndex] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.dahaAzCokStepIndex ?? 0);
  const [initialCorrectCount] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.dahaAzCokCorrectCount ?? 0);
  // Sayfa YENİDEN AÇILDIĞINDA oyun zaten bitmişse (status WON/LOST) /challenge'ı hiç
  // çağırmıyoruz — o uç nokta "bir sonraki gizemli öğeyi" bulmak için var, MAX_STEPS-1'e
  // clamp'lenmiş bir stepIndex ile çağrılırsa SON turun öğesini "sıradaki" diye tekrar
  // döndürüyor (bkz. route.ts), bu da rightItem'ın leftItem ile AYNI öğeyi göstermesine
  // (donmuş ekranda "iki taraf da aynı film" gibi) yol açıyordu. Bitmiş bir oyunun zaten
  // sorulacak yeni bir öğesi yok — nextItem/attemptsToken hiç gerekmiyor.
  const [initialStatus] = useState(() => getGameStat(gameId, todayKey, isArsiv)?.status ?? "PLAYING");

  useEffect(() => {
    if (initialStatus !== "PLAYING") return;

    let cancelled = false;

    /* İlerleme ARTIK sunucuya bildirilmiyor: stepIndex=4 denilerek 1 yerine 5 öğe,
       değerleriyle birlikte tek istekte alınabiliyordu (bkz. challenge route).
       Devam etme, saklanan imzalı token + saklanan revealedItems ile yapılıyor. */
    const qs = new URLSearchParams({ date: todayKey, category: categoryId });
    /* Saklanan token GÖNDERİLİYOR: sunucu kaçıncı adımda olduğumuzu ondan
       okuyor. Gönderilmezse sıradaki öğe olarak zincirin 2. öğesi dönüyor ve
       yarım kalmış bir oyuna dönüldüğünde iki kart da aynı öğeyi gösteriyordu.
       Token'ı sunucu imzaladığı için bu, ilerlemeyi istemciye sormak değil —
       kendi imzasını geri okumak (bkz. challenge route). */
    if (storedToken) qs.set("token", storedToken);

    fetch(`/api/daha-az-cok/challenge?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ChallengeResponse | null) => {
        if (cancelled) return;
        if (data) {
          setNextItem(data.nextItem);
          setAttemptsToken(storedToken ?? data.attemptsToken);
          setRevealedItems((prev) => (prev.length > 0 ? prev : data.revealedItems));
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
  }, [todayKey, categoryId, initialStepIndex, initialCorrectCount, initialStatus, storedToken]);

  const persist = useCallback(
    (nextRevealedItems: Item[], nextRoundResults: boolean[], nextStatus: GameStatus, nextToken?: string) => {
      setRevealedItems(nextRevealedItems);
      setRoundResults(nextRoundResults);
      setStatus(nextStatus);
      if (nextStatus !== "PLAYING") setShowResult(true);
      const stat = {
        status: nextStatus,
        attempts: nextRoundResults.length,
        dahaAzCokRevealedItems: nextRevealedItems,
        dahaAzCokStepIndex: nextRevealedItems.length - 1,
        dahaAzCokCorrectCount: nextRoundResults.filter(Boolean).length,
        dahaAzCokRoundResults: nextRoundResults,
        attemptsToken: nextToken,
      };
      setGameStat(gameId, stat, todayKey, isArsiv);
      if (nextStatus !== "PLAYING") syncFinishedGamePayload(gameId, todayKey, stat);
    },
    [gameId, todayKey, isArsiv]
  );

  const submitGuess = useCallback(
    async (direction: GuessDirection) => {
      if (status !== "PLAYING" || !attemptsToken || submitting || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);

      try {
        const res = await fetch("/api/daha-az-cok/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: todayKey, category: categoryId, guess: direction, attemptsToken }),
        });
        if (!res.ok) return;

        const data: GuessResponse = await res.json();

        // 1. aşama: kartın gerçek değeri açığa çıkar, 0'dan sayarak yükselmeye başlar —
        // henüz renk yok, kullanıcı önce sayıyı okusun.
        setRevealingValue(data.revealedItem.value);
        setLastCorrect(data.correct);

        await new Promise((resolve) => setTimeout(resolve, COUNT_UP_MS));

        // 2. aşama: sayı durdu, doğru/yanlış rengi yanıyor — bir süre böyle kalıyor,
        // çiftler henüz kaymıyor.
        setShowOutcome(true);
        await new Promise((resolve) => setTimeout(resolve, OUTCOME_HOLD_MS));

        const nextRevealedItems = [...revealedItems, data.revealedItem];
        const nextRoundResults = [...roundResults, data.correct];

        if (data.status === "WON") {
          // Son turdu — leftItem/rightItem artık (aşağıda) finished durumunda doğrudan
          // revealedItems'ın son iki öğesinden türetiliyor, o yüzden revealingValue/
          // nextItem'a hiç ihtiyaç yok; normal shift'i uyguluyoruz, "finished" dalı
          // gösterimi otomatik devralıyor (sayfa yenilense bile kalıcı — bkz. leftItem/
          // rightItem hesaplaması).
          persist(nextRevealedItems, nextRoundResults, "WON");
        } else if (data.attemptsToken && data.nextItem) {
          // 3. aşama: çiftleri kaydır — açığa çıkan öğe artık sol karta (referans) geçiyor,
          // yeni bir gizemli öğe sağ karta geliyor.
          setRevealingValue(null);
          setLastCorrect(null);
          setShowOutcome(false);
          setAttemptsToken(data.attemptsToken);
          setNextItem(data.nextItem);
          persist(nextRevealedItems, nextRoundResults, "PLAYING", data.attemptsToken);
        }
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [status, attemptsToken, submitting, todayKey, categoryId, revealedItems, roundResults, persist]
  );

  const dismissResult = useCallback(() => setShowResult(false), []);
  const openResult = useCallback(() => setShowResult(true), []);

  // Oyun bitince leftItem/rightItem artık revealedItems'ın son iki öğesinden DOĞRUDAN
  // türetiliyor — ikisi de zaten açığa çıkmış, gerçek değerleriyle localStorage'da kalıcı
  // duruyor. Bu sayede son karşılaştırma sayfa yenilense/kategoriler arası geçilip geri
  // dönülse bile hep aynı (donmuş) haliyle görünüyor; nextItem/revealingValue gibi
  // sayfa yenilenince sıfırlanan geçici state'e bağımlı değil.
  const finished = status === "WON";
  const leftItem =
    finished && revealedItems.length >= 2
      ? revealedItems[revealedItems.length - 2]
      : (revealedItems[revealedItems.length - 1] ?? null);
  const rightItem: RevealableItem | null =
    finished && revealedItems.length >= 2
      ? revealedItems[revealedItems.length - 1]
      : nextItem
        ? { ...nextItem, value: revealingValue ?? undefined }
        : null;
  const stepIndex = revealedItems.length > 0 ? revealedItems.length - 1 : 0;
  const correctCount = roundResults.filter(Boolean).length;

  return {
    loading,
    notFound,
    status,
    leftItem,
    rightItem,
    lastCorrect,
    showOutcome,
    stepIndex,
    correctCount,
    roundResults,
    maxSteps: MAX_STEPS,
    submitting,
    showResult,
    dismissResult,
    openResult,
    submitGuess,
  };
}

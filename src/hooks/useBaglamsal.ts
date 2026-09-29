"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GAME_ID, GROUP_COUNT, GROUP_SIZE, MAX_MISTAKES, type SolvedGroup } from "@/lib/baglamsal";
import { getGameStat, setGameStat, syncFinishedGamePayload } from "@/lib/storage";
import type { GameStatus } from "@/lib/types";
import { getTodayKey } from "@/lib/utils";

interface ChallengeResponse {
  words: string[];
  stateToken: string;
}

interface GuessResponse {
  correct: boolean;
  group?: SolvedGroup;
  oneAway?: boolean;
  mistakes: number;
  finished: boolean;
  allGroups?: SolvedGroup[];
  stateToken: string;
}

export function useBaglamsal(arsivTarihi?: string) {
  const todayKey = useMemo(() => arsivTarihi ?? getTodayKey(), [arsivTarihi]);
  const isArsiv = !!arsivTarihi;

  const [solved, setSolved] = useState<SolvedGroup[]>(
    () => getGameStat(GAME_ID, todayKey, isArsiv)?.baglamsalSolved ?? []
  );
  const [mistakes, setMistakes] = useState(
    () => getGameStat(GAME_ID, todayKey, isArsiv)?.baglamsalMistakes ?? 0
  );
  const [allGroups, setAllGroups] = useState<SolvedGroup[] | null>(
    () => getGameStat(GAME_ID, todayKey, isArsiv)?.baglamsalAllGroups ?? null
  );
  const [status, setStatus] = useState<GameStatus>(
    () => getGameStat(GAME_ID, todayKey, isArsiv)?.status ?? "PLAYING"
  );

  const [words, setWords] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [stateToken, setStateToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shakeToken, setShakeToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [storedToken] = useState(() => getGameStat(GAME_ID, todayKey, isArsiv)?.attemptsToken);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/baglamsal/challenge?date=${todayKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ChallengeResponse | null) => {
        if (cancelled) return;
        if (data) {
          setWords(data.words);
          setStateToken(storedToken ?? data.stateToken);
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
  }, [todayKey, storedToken]);

  const persist = useCallback(
    (
      nextSolved: SolvedGroup[],
      nextMistakes: number,
      nextStatus: GameStatus,
      nextAll: SolvedGroup[] | null,
      nextToken: string
    ) => {
      setSolved(nextSolved);
      setMistakes(nextMistakes);
      setStatus(nextStatus);
      setAllGroups(nextAll);
      if (nextStatus !== "PLAYING") setShowResult(true);
      const stat = {
        status: nextStatus,
        attempts: nextMistakes,
        baglamsalSolved: nextSolved,
        baglamsalMistakes: nextMistakes,
        baglamsalAllGroups: nextAll ?? undefined,
        attemptsToken: nextToken,
      };
      setGameStat(GAME_ID, stat, todayKey, isArsiv);
      if (nextStatus !== "PLAYING") syncFinishedGamePayload(GAME_ID, todayKey, stat);
    },
    [todayKey, isArsiv]
  );

  const toggle = useCallback(
    (word: string) => {
      if (status !== "PLAYING" || submitting) return;
      setMessage(null);
      setSelected((prev) =>
        prev.includes(word)
          ? prev.filter((w) => w !== word)
          : prev.length < GROUP_SIZE
            ? [...prev, word]
            : prev
      );
    },
    [status, submitting]
  );

  const submit = useCallback(async () => {
    if (status !== "PLAYING" || submitting || selected.length !== GROUP_SIZE || !stateToken) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/baglamsal/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayKey, words: selected, stateToken }),
      });
      if (!res.ok) return;
      const data: GuessResponse = await res.json();
      setStateToken(data.stateToken);

      if (data.correct && data.group) {
        const nextSolved = [...solved, data.group];
        setSelected([]);
        persist(
          nextSolved,
          data.mistakes,
          data.finished ? "WON" : "PLAYING",
          data.allGroups ?? null,
          data.stateToken
        );
        return;
      }

      setShakeToken((t) => t + 1);
      setMessage(data.oneAway ? "Bir tane eksik!" : "Olmadı");
      persist(solved, data.mistakes, data.finished ? "LOST" : "PLAYING", data.allGroups ?? null, data.stateToken);
      if (data.finished) setSelected([]);
    } finally {
      setSubmitting(false);
    }
  }, [status, submitting, selected, stateToken, todayKey, solved, persist]);

  const cozulmusKelimeler = useMemo(() => new Set(solved.flatMap((g) => g.words)), [solved]);
  const kalanKelimeler = useMemo(
    () => words.filter((w) => !cozulmusKelimeler.has(w)),
    [words, cozulmusKelimeler]
  );

  return {
    loading,
    notFound,
    status,
    words: kalanKelimeler,
    solved,
    allGroups,
    selected,
    mistakes,
    maxMistakes: MAX_MISTAKES,
    groupCount: GROUP_COUNT,
    message,
    shakeToken,
    submitting,
    showResult,
    toggle,
    submit,
    deselectAll: () => setSelected([]),
    shuffle: () => setWords((w) => [...w].sort(() => Math.random() - 0.5)),
    dismissResult: () => setShowResult(false),
    openResult: () => setShowResult(true),
  };
}

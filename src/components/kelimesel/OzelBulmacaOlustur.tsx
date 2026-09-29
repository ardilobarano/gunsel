"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import CycleSelect from "@/components/CycleSelect";
import Stepper from "@/components/Stepper";
import {
  CUSTOM_MODE_OPTIONS,
  CUSTOM_TIME_LIMIT_OPTIONS,
  MAX_CUSTOM_WORDS,
  MAX_LENGTH,
  MIN_LENGTH,
  type CustomMode,
} from "@/lib/kelimesel";
import { trUpper } from "@/lib/utils";

interface CreateResponse {
  shareCode?: string;
  error?: string;
}

const DICTIONARY_OPTIONS = [
  { value: true, label: "Enabled" },
  { value: false, label: "Disabled" },
];

export default function OzelBulmacaOlustur() {
  const [words, setWords] = useState<string[]>([""]);
  const [maxGuesses, setMaxGuesses] = useState(6);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [dictionaryEnabled, setDictionaryEnabled] = useState(true);
  const [mode, setMode] = useState<CustomMode>("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function updateWord(index: number, value: string) {
    const upper = trUpper(value).slice(0, MAX_LENGTH);
    setWords((prev) => prev.map((w, i) => (i === index ? upper : w)));
  }

  function addWord() {
    if (words.length >= MAX_CUSTOM_WORDS) return;
    setWords((prev) => [...prev, ""]);
  }

  function removeWord(index: number) {
    setWords((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    setError(null);

    const trimmed = words.map((w) => w.trim());
    if (trimmed.some((w) => w.length < MIN_LENGTH)) {
      setError(`Her kelime en az ${MIN_LENGTH} harf olmalı.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/kelimesel/ozel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: trimmed, maxGuesses, timeLimitSeconds, dictionaryEnabled, mode }),
      });
      const data: CreateResponse = await res.json();
      if (!res.ok || !data.shareCode) {
        setError(data.error ?? "Bir şeyler ters gitti.");
        return;
      }
      setShareCode(data.shareCode);
    } catch {
      setError("Bağlamsal hatası, tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy() {
    if (!shareCode) return;
    const url = `https://gunsel.app/kelimesel/ozel/${shareCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (shareCode) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
        <p className="text-lg font-semibold text-text-main">Bulmacan hazır! 🎉</p>
        <p className="rounded-lg border border-border-subtle bg-card px-4 py-2 font-mono text-sm text-text-main">
          gunsel.app/kelimesel/ozel/{shareCode}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            {copied ? "Kopyalandı!" : "Linki Kopyala"}
          </button>
          <Link
            href={`/kelimesel/ozel/${shareCode}`}
            className="rounded-lg border border-border-subtle bg-card-hover px-4 py-2.5 text-sm font-semibold text-text-main transition-colors hover:bg-card"
          >
            Oyna
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {words.map((word, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-card px-3 py-2">
              <span className="text-sm text-text-muted">{i + 1})</span>
              <input
                value={word}
                onChange={(e) => updateWord(i, e.target.value)}
                maxLength={MAX_LENGTH}
                className="flex-1 bg-transparent text-sm font-semibold uppercase text-text-main outline-none"
                placeholder="KELİME"
              />
              <span className="text-xs text-text-muted">
                {word.length} / {MAX_LENGTH}
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeWord(i)}
              disabled={words.length <= 1}
              aria-label="Kelimeyi sil"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-red text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {i === words.length - 1 && words.length < MAX_CUSTOM_WORDS && (
              <button
                type="button"
                onClick={addWord}
                aria-label="Kelime ekle"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-card-hover text-text-main transition-colors hover:bg-card"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <Stepper value={maxGuesses} min={1} max={10} onChange={setMaxGuesses} label="Max Guesses" />
        <CycleSelect
          value={timeLimitSeconds}
          options={CUSTOM_TIME_LIMIT_OPTIONS}
          onChange={setTimeLimitSeconds}
          label="Time Limit"
        />
        <CycleSelect value={dictionaryEnabled} options={DICTIONARY_OPTIONS} onChange={setDictionaryEnabled} label="Dictionary" />
        <CycleSelect value={mode} options={CUSTOM_MODE_OPTIONS} onChange={setMode} label="Mode" />
      </div>

      {error && <p className="text-center text-sm font-medium text-accent-red">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="self-end rounded-lg bg-accent-green px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Oluşturuluyor..." : "Create"}
      </button>
    </div>
  );
}

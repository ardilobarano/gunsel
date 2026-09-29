"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useAcilisYonu } from "@/hooks/useAcilisYonu";
import type { MovieResult } from "@/lib/karesel";
import { cn } from "@/lib/utils";

interface MovieSearchProps {
  onSelect: (movie: MovieResult) => void;
  onSkip: () => void;
  disabled?: boolean;
  isLastAttempt?: boolean;
  /** Aramanın TMDB'de film mi dizi mi sorgulayacağını belirliyor. */
  kategoriId: string;
}


export default function MovieSearch({ onSelect, onSkip, disabled, isLastAttempt, kategoriId }: MovieSearchProps) {
  const [query, setQuery] = useState("");

  const [results, setResults] = useState<MovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { kapsayiciRef, yukariAc, konum, olc } = useAcilisYonu(open);
  const requestIdRef = useRef(0);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) return;

    const q = trimmedQuery;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/karesel/search?q=${encodeURIComponent(q)}&kategori=${kategoriId}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: MovieResult[] }) => {
          if (requestIdRef.current !== requestId) return;
          setResults(data.results ?? []);
          olc(220);
          setLoading(false);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setResults([]);
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [trimmedQuery, kategoriId, olc]);

  /* Odak kaybinda kapanmiyor; gerekcesi SongSearch te yazili (telefonda
     klavyeyi kapatmak listeyi de yok ediyordu). Disari tiklama dinleniyor. */
  const listeRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const disariTiklandi = (e: MouseEvent) => {
      const t = e.target as Node;
      if (kapsayiciRef.current?.contains(t) || listeRef.current?.contains(t)) return;
      setOpen(false);
    };
    /* Gerekçesi SongSearch'te yazılı: `pointerdown` telefonda kaydırma
       başlangıcını da "dışarı tıklama" sayıp listeyi kapatıyordu. */
    document.addEventListener("click", disariTiklandi);
    return () => document.removeEventListener("click", disariTiklandi);
  }, [open, kapsayiciRef]);

  const visibleResults = trimmedQuery ? results : [];
  const visibleLoading = trimmedQuery ? loading : false;

  function handleSelect(movie: MovieResult) {
    if (disabled) return;
    onSelect(movie);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="flex w-full items-center gap-2">
      <div ref={kapsayiciRef} className="relative flex-1">
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-card px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={kategoriId === "dizi" ? "Bir dizi ara" : "Bir film ara"}
            className="w-full bg-transparent text-sm text-text-main placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
          />
          {visibleLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-muted" />}
        </div>

        {/* Portal + fixed konum — gerekçesi SongSearch'te yazılı: kabın
            `overflow-y-auto`'su listeyi kenarda kırpıyordu. */}
        {open && visibleResults.length > 0 && konum && createPortal(
          <ul
            ref={listeRef}
            style={{
              left: konum.sol,
              width: konum.genislik,
              ...(yukariAc
                ? { bottom: window.innerHeight - konum.ust + 4 }
                : { top: konum.alt + 4 }),
            }}
            className={cn(
              "fixed z-50 max-h-52 overflow-y-auto rounded-lg border border-border-subtle bg-card shadow-lg sm:max-h-72"
            )}
          >
            {visibleResults.map((movie) => (
              <li key={movie.tmdbId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(movie)}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-card-hover"
                >
                  <span className="font-medium text-text-main">
                    {movie.title}
                    {movie.year ? ` (${movie.year})` : ""}
                  </span>
                  {movie.originalTitle !== movie.title && (
                    <span className="text-xs text-text-muted">{movie.originalTitle}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
      </div>

      <button
        type="button"
        onClick={onSkip}
        disabled={disabled}
        className="shrink-0 rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-main transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLastAttempt ? "Pes Et" : "Pas Geç"}
      </button>
    </div>
  );
}

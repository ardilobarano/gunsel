"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useAcilisYonu } from "@/hooks/useAcilisYonu";
import type { SpotifyTrackResult } from "@/lib/sarkisal";
import { cn } from "@/lib/utils";

interface SongSearchProps {
  onSelect: (song: SpotifyTrackResult) => void;
  onSkip: () => void;
  disabled?: boolean;
  isLastAttempt?: boolean;
}


export default function SongSearch({ onSelect, onSkip, disabled, isLastAttempt }: SongSearchProps) {
  const [query, setQuery] = useState("");

  const [results, setResults] = useState<SpotifyTrackResult[]>([]);
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
      fetch(`/api/sarkisal/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: SpotifyTrackResult[] }) => {
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
  }, [trimmedQuery, olc]);

  /* Liste ARTIK ODAK KAYBINDA KAPANMIYOR. Eskiden `onBlur` kapatıyordu ve
     telefonda klavyeyi kapatmak da odağı düşürdüğü için liste bir anda yok
     oluyordu — oyuncu sonuçları okuyamadan gidiyordu (kullanıcı bildirdi).
     Bunun yerine DIŞARI TIKLAMA dinleniyor. Liste portal ile body altında
     olduğu için "içeride mi" kontrolü hem kutuyu hem listeyi kapsamalı. */
  const listeRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const disariTiklandi = (e: MouseEvent) => {
      const t = e.target as Node;
      if (kapsayiciRef.current?.contains(t) || listeRef.current?.contains(t)) return;
      setOpen(false);
    };
    /* `click`, `pointerdown` DEĞİL: telefonda sayfayı kaydırmak da parmağı
       listenin dışına değdirmek demek, bu yüzden pointerdown ile liste
       kaydırılır kaydırılmaz kapanıyordu (kullanıcı bildirdi). Kaydırma jesti
       click üretmez, yalnızca gerçek bir dokunuş üretir. */
    document.addEventListener("click", disariTiklandi);
    return () => document.removeEventListener("click", disariTiklandi);
  }, [open, kapsayiciRef]);

  const visibleResults = trimmedQuery ? results : [];
  const visibleLoading = trimmedQuery ? loading : false;

  function handleSelect(song: SpotifyTrackResult) {
    if (disabled) return;
    onSelect(song);
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
            placeholder="Bir şarkı ara"
            className="w-full bg-transparent text-sm text-text-main placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
          />
          {visibleLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-muted" />}
        </div>

        {/* Listenin yükseklik sınırı şart: sınırsızken 418px'e kadar uzuyordu ve telefonda
            klavye açıkken (görünen alan ~340px) sonuçlar ekranın altında kalıyordu.
            Telefonda daha dar, masaüstünde geniş. */}
        {/* Liste `body` altına PORTAL ile taşınıyor ve `fixed` konumlanıyor.
            Kabın içinde `absolute` kaldığında oyun sayfasının `overflow-y-auto`
            sarmalayıcısı onu kabın kenarında KIRPIYORDU: 8 sonuçtan yalnızca
            biri görünüyor, gerisi için listenin içinde kaydırmak gerekiyordu
            (kullanıcı gerçek cihazda bildirdi). Portal sayesinde liste alttaki
            tanıtım metninin üstüne taşabiliyor. */}
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
            {visibleResults.map((song) => (
              <li key={song.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(song)}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-card-hover"
                >
                  <span className="font-medium text-text-main">{song.title}</span>
                  <span className="text-xs text-text-muted">{song.artist}</span>
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

"use client";

import { Clapperboard, Hexagon, Music, Scale, Type, type LucideIcon } from "lucide-react";
import {
  DEMO_DATE,
  DEMO_GAMES,
  DEMO_GUESSES,
  DEMO_MAX_ATTEMPTS,
  DEMO_WORD_LENGTH,
  KEYBOARD_ROWS,
  KEY_STATES,
  type TileState,
} from "./demoData";

/**
 * YÖN A — "Gazete".
 * Koyu/minimal yerine kağıt: krem zemin, siyah mürekkep, serif başlıklar, ince
 * çizgiler. Kart kutusu YOK — gazete künyesi gibi yatay ayraçlarla sıralanmış
 * girişler. Tek vurgu rengi mürekkep kırmızısı.
 */

const INK = "#171310";
const PAPER = "#f3ede1";
const RED = "#8c1d18";

const ICONS: Record<string, LucideIcon> = {
  kelimesel: Type,
  sarkisal: Music,
  harfBahcesi: Hexagon,
  dahaAzCok: Scale,
  karesel: Clapperboard,
};

function Kunye() {
  return (
    <header className="border-b-4 border-double" style={{ borderColor: INK }}>
      <div className="flex items-center justify-between px-4 pt-3 text-[10px] tracking-[0.2em] uppercase" style={{ color: RED }}>
        <span>Sayı 214</span>
        <span>Günlük Bulmaca</span>
      </div>
      <h1
        className="font-serif px-4 pt-1 text-center text-[3.25rem] leading-[0.95] font-black tracking-[-0.03em]"
        style={{ color: INK }}
      >
        GÜNSEL
      </h1>
      <div
        className="mx-4 mt-2 mb-2 flex items-center justify-center gap-3 border-t border-b py-1 text-[10px] tracking-[0.18em] uppercase"
        style={{ borderColor: INK, color: INK }}
      >
        {DEMO_DATE}
      </div>
    </header>
  );
}

function GazeteHub() {
  return (
    <>
      <Kunye />
      <main className="px-4 pb-10">
        <p className="font-serif py-5 text-center text-[15px] italic" style={{ color: `${INK}b0` }}>
          Bugünün beş bulmacası aşağıda. Her gece yarısı yenilenir.
        </p>

        <ol>
          {DEMO_GAMES.map((game, i) => {
            const Icon = ICONS[game.id];
            return (
              <li
                key={game.id}
                className="flex items-center gap-4 border-t py-4"
                style={{ borderColor: `${INK}25` }}
              >
                <span
                  className="font-serif w-7 shrink-0 text-2xl leading-none font-black tabular-nums"
                  style={{ color: `${INK}30` }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: RED }} strokeWidth={2} />
                    <h2 className="font-serif truncate text-[22px] leading-tight font-bold" style={{ color: INK }}>
                      {game.name}
                    </h2>
                  </div>
                  <p className="mt-0.5 text-[11px] tracking-[0.14em] uppercase" style={{ color: `${INK}80` }}>
                    {game.tagline}
                  </p>
                </div>

                {game.done ? (
                  <span
                    className="shrink-0 rotate-[-8deg] border px-1.5 py-0.5 text-[9px] font-bold tracking-[0.15em] uppercase"
                    style={{ borderColor: RED, color: RED }}
                  >
                    Çözüldü
                  </span>
                ) : (
                  <span className="font-serif shrink-0 text-2xl" style={{ color: `${INK}40` }}>
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-6 border-t-4 border-double pt-3 text-center" style={{ borderColor: INK }}>
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: `${INK}70` }}>
            Günsel · Her gün yeni bulmacalar
          </p>
        </div>
      </main>
    </>
  );
}

const TILE_STYLE: Record<TileState, { bg: string; fg: string; border: string }> = {
  correct: { bg: INK, fg: PAPER, border: INK },
  present: { bg: RED, fg: PAPER, border: RED },
  absent: { bg: "transparent", fg: `${INK}45`, border: `${INK}25` },
  empty: { bg: "transparent", fg: INK, border: `${INK}25` },
};

function GazeteOyun() {
  const rows = Array.from({ length: DEMO_MAX_ATTEMPTS }, (_, r) => DEMO_GUESSES[r] ?? null);

  return (
    <>
      <Kunye />
      <main className="flex flex-col items-center px-4 pt-4 pb-6">
        <h2 className="font-serif text-[28px] font-bold" style={{ color: INK }}>
          Kelimesel
        </h2>
        <p className="mt-0.5 mb-4 text-[10px] tracking-[0.2em] uppercase" style={{ color: `${INK}80` }}>
          Beş harf · Altı hak
        </p>

        <div className="flex flex-col gap-1.5">
          {rows.map((row, r) => (
            <div key={r} className="flex gap-1.5">
              {Array.from({ length: DEMO_WORD_LENGTH }, (_, c) => {
                const tile = row?.[c];
                const s = TILE_STYLE[tile?.state ?? "empty"];
                return (
                  <div
                    key={c}
                    className="font-serif flex h-11 w-11 items-center justify-center border text-xl font-bold"
                    style={{ background: s.bg, color: s.fg, borderColor: s.border }}
                  >
                    {tile?.letter ?? ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-6 flex w-full max-w-sm flex-col gap-1.5">
          {KEYBOARD_ROWS.map((row, i) => (
            <div key={i} className="flex justify-center gap-1">
              {row.map((key) => {
                const state = KEY_STATES[key];
                const wide = key.length > 1;
                const s = state ? TILE_STYLE[state] : null;
                return (
                  <button
                    key={key}
                    className="flex h-11 items-center justify-center border text-[11px] font-bold tracking-wide"
                    style={{
                      flex: wide ? "1.6 1 0" : "1 1 0",
                      background: s?.bg ?? "transparent",
                      color: s?.fg ?? INK,
                      borderColor: s?.border ?? `${INK}30`,
                    }}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

export default function GazeteDemo({ view }: { view: "hub" | "game" }) {
  return (
    <div
      className="min-h-full"
      style={{
        /* font-serif utility'sini bu ağaç içinde Playfair'e bağlıyor; geri kalan
           küçük etiketler sistem sans'ında kalıyor (gazete tipografisi böyle). */
        ["--font-serif" as string]: "var(--font-gazete)",
        background: PAPER,
        /* Kağıt dokusu: çok düşük kontrastlı iki katman, görsel dosyası olmadan. */
        backgroundImage:
          "radial-gradient(rgba(23,19,16,0.045) 1px, transparent 1px), radial-gradient(rgba(23,19,16,0.03) 1px, transparent 1px)",
        backgroundSize: "18px 18px, 11px 11px",
        backgroundPosition: "0 0, 5px 7px",
      }}
    >
      {view === "hub" ? <GazeteHub /> : <GazeteOyun />}
    </div>
  );
}

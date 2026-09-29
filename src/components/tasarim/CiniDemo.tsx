"use client";

import { Check, Clapperboard, Hexagon, Music, Scale, Type, type LucideIcon } from "lucide-react";
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
 * YÖN B — "Çini".
 * İznik çinisi paleti: derin kobalt zemin, krem "sır" yüzeyler, turkuaz/mercan/altın
 * vurgular ve lale motifi. Renk hikâyesi ve süsleme lessgames'in nötr koyu grisiyle
 * hiç örtüşmüyor; ayrıca Türkçe bir bulmaca sitesine kültürel bir kimlik veriyor.
 */

const COBALT = "#0f2f5c";
const COBALT_2 = "#16407a";
const CREAM = "#f6efdf";
const TURQUOISE = "#3aa8a0";
const CORAL = "#cf4237";
const GOLD = "#d9a441";

const ICONS: Record<string, LucideIcon> = {
  kelimesel: Type,
  sarkisal: Music,
  harfBahcesi: Hexagon,
  dahaAzCok: Scale,
  karesel: Clapperboard,
};

const CARD_ACCENTS = [TURQUOISE, CORAL, GOLD, TURQUOISE, CORAL];

/** Lale + nokta örgüsü — çini zemininin tekrar eden motifi. */
function LaleDeseni({ opacity = 0.09 }: { opacity?: number }) {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity }}>
      <defs>
        <pattern id="cini-lale" width="56" height="56" patternUnits="userSpaceOnUse">
          <path
            d="M28 40 C21 35 18 30 18 25.5 C18 22 20 20 22.5 20 C22.5 16.5 25 15 28 15 C31 15 33.5 16.5 33.5 20 C36 20 38 22 38 25.5 C38 30 35 35 28 40 Z"
            fill={CREAM}
          />
          <circle cx="0" cy="0" r="2.5" fill={TURQUOISE} />
          <circle cx="56" cy="0" r="2.5" fill={TURQUOISE} />
          <circle cx="0" cy="56" r="2.5" fill={TURQUOISE} />
          <circle cx="56" cy="56" r="2.5" fill={TURQUOISE} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cini-lale)" />
    </svg>
  );
}

/** Başlık ve altbilgiyi ayıran ince çini şeridi. */
function Serit() {
  return (
    <div
      className="h-2 w-full"
      style={{
        backgroundImage: `repeating-linear-gradient(90deg, ${GOLD} 0 8px, ${TURQUOISE} 8px 16px, ${CORAL} 16px 24px)`,
      }}
    />
  );
}

function CiniBaslik() {
  return (
    <header className="relative overflow-hidden" style={{ background: COBALT_2 }}>
      <LaleDeseni opacity={0.13} />
      <div className="relative px-4 pt-5 pb-4 text-center">
        <h1
          className="text-[2.5rem] leading-none font-extrabold tracking-tight"
          style={{ color: CREAM }}
        >
          Gün<span style={{ color: GOLD }}>sel</span>
        </h1>
        <p className="mt-1.5 text-[11px] tracking-[0.22em] uppercase" style={{ color: `${CREAM}99` }}>
          {DEMO_DATE}
        </p>
      </div>
      <Serit />
    </header>
  );
}

function CiniHub() {
  return (
    <>
      <CiniBaslik />
      <main className="relative px-4 py-5">
        <LaleDeseni opacity={0.05} />
        <div className="relative flex flex-col gap-3">
          {DEMO_GAMES.map((game, i) => {
            const Icon = ICONS[game.id];
            const accent = CARD_ACCENTS[i];
            return (
              <div
                key={game.id}
                className="relative flex items-center gap-3.5 overflow-hidden rounded-xl px-4 py-4"
                style={{ background: CREAM, boxShadow: `0 2px 0 0 ${COBALT}55` }}
              >
                {/* Kartın sol kenarındaki renkli sır şeridi */}
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} />

                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${accent}22`, border: `1.5px solid ${accent}` }}
                >
                  <Icon className="h-5 w-5" style={{ color: accent }} strokeWidth={2.2} />
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] leading-tight font-bold" style={{ color: COBALT }}>
                    {game.name}
                  </h2>
                  <p className="mt-0.5 truncate text-[12px]" style={{ color: `${COBALT}99` }}>
                    {game.tagline}
                  </p>
                </div>

                {game.done && (
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: TURQUOISE }}
                  >
                    <Check className="h-3.5 w-3.5" style={{ color: CREAM }} strokeWidth={3.5} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <div className="mt-2">
        <Serit />
        <p
          className="px-4 py-4 text-center text-[11px] tracking-[0.15em] uppercase"
          style={{ color: `${CREAM}80` }}
        >
          Her gün yeni bulmacalar
        </p>
      </div>
    </>
  );
}

const TILE_STYLE: Record<TileState, { bg: string; fg: string; border: string }> = {
  correct: { bg: TURQUOISE, fg: CREAM, border: TURQUOISE },
  present: { bg: GOLD, fg: COBALT, border: GOLD },
  absent: { bg: `${CREAM}18`, fg: `${CREAM}55`, border: `${CREAM}25` },
  empty: { bg: "transparent", fg: CREAM, border: `${CREAM}35` },
};

function CiniOyun() {
  const rows = Array.from({ length: DEMO_MAX_ATTEMPTS }, (_, r) => DEMO_GUESSES[r] ?? null);

  return (
    <>
      <CiniBaslik />
      <main className="relative flex flex-col items-center px-4 pt-5 pb-6">
        <LaleDeseni opacity={0.05} />
        <div className="relative flex flex-col items-center">
          <h2 className="text-[22px] font-bold" style={{ color: CREAM }}>
            Kelimesel
          </h2>
          <p className="mt-0.5 mb-4 text-[11px] tracking-[0.2em] uppercase" style={{ color: `${CREAM}80` }}>
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
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-xl font-bold"
                      style={{ background: s.bg, color: s.fg, border: `2px solid ${s.border}` }}
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
                      className="flex h-11 items-center justify-center rounded-md text-[11px] font-bold"
                      style={{
                        flex: wide ? "1.6 1 0" : "1 1 0",
                        background: s?.bg ?? `${CREAM}1a`,
                        color: s?.fg ?? CREAM,
                        border: `1px solid ${s?.border ?? `${CREAM}30`}`,
                      }}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

export default function CiniDemo({ view }: { view: "hub" | "game" }) {
  return (
    <div className="min-h-full" style={{ background: COBALT, fontFamily: "var(--font-cini)" }}>
      {view === "hub" ? <CiniHub /> : <CiniOyun />}
    </div>
  );
}

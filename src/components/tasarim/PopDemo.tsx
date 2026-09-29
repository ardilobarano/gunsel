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
 * YÖN C — "Pop".
 * Neo-brutalist: açık zemin, 3px siyah kontur, ofset sert gölge (blur yok), her oyuna
 * ayrı doygun renk ve iri büyük harf tipografi. lessgames'in düşük kontrastlı, tek
 * vurgu renkli sakin diliyle taban tabana zıt — oyunlar renklerinden tanınıyor.
 */

const BLACK = "#141414";
const BG = "#f4f1e8";

const ICONS: Record<string, LucideIcon> = {
  kelimesel: Type,
  sarkisal: Music,
  harfBahcesi: Hexagon,
  dahaAzCok: Scale,
  karesel: Clapperboard,
};

/** Her oyunun kendi rengi — kart, ikon ve rozet aynı renkten. */
const GAME_COLORS: Record<string, string> = {
  kelimesel: "#ffd93d",
  sarkisal: "#ff8fab",
  harfBahcesi: "#9ae66e",
  dahaAzCok: "#7cc6fe",
  karesel: "#ffa552",
};

const HARD = `4px 4px 0 0 ${BLACK}`;
const HARD_SM = `2px 2px 0 0 ${BLACK}`;

function PopBaslik() {
  return (
    <header className="px-4 pt-5 pb-4">
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: BLACK, boxShadow: HARD, border: `3px solid ${BLACK}` }}
      >
        <span className="text-[26px] leading-none font-black tracking-tight" style={{ color: BG }}>
          GÜN<span style={{ color: "#ffd93d" }}>SEL</span>
        </span>
        <span
          className="rounded-md px-2 py-1 text-[10px] font-black tracking-wider uppercase"
          style={{ background: "#ffd93d", color: BLACK }}
        >
          6 Ağu
        </span>
      </div>
    </header>
  );
}

function PopHub() {
  return (
    <>
      <PopBaslik />
      <main className="px-4 pb-8">
        <h1 className="mb-1 text-[30px] leading-none font-black tracking-tight" style={{ color: BLACK }}>
          BUGÜN NE
          <br />
          OYNUYORUZ?
        </h1>
        <p className="mb-5 text-[12px] font-bold tracking-wide uppercase" style={{ color: `${BLACK}80` }}>
          {DEMO_DATE}
        </p>

        <div className="flex flex-col gap-4">
          {DEMO_GAMES.map((game) => {
            const Icon = ICONS[game.id];
            const color = GAME_COLORS[game.id];
            return (
              <div
                key={game.id}
                className="relative flex items-center gap-4 rounded-xl px-4 py-4"
                style={{ background: color, border: `3px solid ${BLACK}`, boxShadow: HARD }}
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: BG, border: `3px solid ${BLACK}` }}
                >
                  <Icon className="h-6 w-6" style={{ color: BLACK }} strokeWidth={2.6} />
                </span>

                <div className="min-w-0 flex-1">
                  <h2
                    className="truncate text-[19px] leading-none font-black tracking-tight uppercase"
                    style={{ color: BLACK }}
                  >
                    {game.name}
                  </h2>
                  <p className="mt-1 truncate text-[12px] font-semibold" style={{ color: `${BLACK}b0` }}>
                    {game.tagline}
                  </p>
                </div>

                {game.done ? (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: BLACK }}
                  >
                    <Check className="h-4 w-4" style={{ color: color }} strokeWidth={4} />
                  </span>
                ) : (
                  <span className="shrink-0 text-2xl font-black" style={{ color: BLACK }}>
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer
        className="mx-4 mb-6 rounded-xl px-4 py-3 text-center text-[11px] font-black tracking-widest uppercase"
        style={{ background: BLACK, color: BG, boxShadow: HARD }}
      >
        Her gün yeni bulmacalar
      </footer>
    </>
  );
}

const TILE_STYLE: Record<TileState, { bg: string; fg: string }> = {
  correct: { bg: "#9ae66e", fg: BLACK },
  present: { bg: "#ffd93d", fg: BLACK },
  absent: { bg: "#d6d1c4", fg: `${BLACK}70` },
  empty: { bg: BG, fg: BLACK },
};

function PopOyun() {
  const rows = Array.from({ length: DEMO_MAX_ATTEMPTS }, (_, r) => DEMO_GUESSES[r] ?? null);

  return (
    <>
      <PopBaslik />
      <main className="flex flex-col items-center px-4 pb-6">
        <div
          className="mb-4 rounded-lg px-4 py-1.5"
          style={{ background: GAME_COLORS.kelimesel, border: `3px solid ${BLACK}`, boxShadow: HARD_SM }}
        >
          <h2 className="text-[18px] leading-tight font-black tracking-tight uppercase" style={{ color: BLACK }}>
            Kelimesel · 5 harf
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {rows.map((row, r) => (
            <div key={r} className="flex gap-2">
              {Array.from({ length: DEMO_WORD_LENGTH }, (_, c) => {
                const tile = row?.[c];
                const s = TILE_STYLE[tile?.state ?? "empty"];
                return (
                  <div
                    key={c}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-xl font-black"
                    style={{ background: s.bg, color: s.fg, border: `3px solid ${BLACK}`, boxShadow: HARD_SM }}
                  >
                    {tile?.letter ?? ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
          {KEYBOARD_ROWS.map((row, i) => (
            <div key={i} className="flex justify-center gap-1.5">
              {row.map((key) => {
                const state = KEY_STATES[key];
                const wide = key.length > 1;
                const s = state ? TILE_STYLE[state] : null;
                return (
                  <button
                    key={key}
                    className="flex h-11 items-center justify-center rounded-md text-[11px] font-black"
                    style={{
                      flex: wide ? "1.7 1 0" : "1 1 0",
                      background: s?.bg ?? "#ffffff",
                      color: s?.fg ?? BLACK,
                      border: `2.5px solid ${BLACK}`,
                      boxShadow: HARD_SM,
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

export default function PopDemo({ view }: { view: "hub" | "game" }) {
  return (
    <div className="min-h-full" style={{ background: BG, fontFamily: "var(--font-pop)" }}>
      {view === "hub" ? <PopHub /> : <PopOyun />}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { LEVEL_COLORS } from "@/lib/baglamsal";
import { useBaglamsal } from "@/hooks/useBaglamsal";
import BaglamsalSonucModal from "./BaglamsalSonucModal";
import { cn } from "@/lib/utils";

export default function BaglamsalGame({ arsivTarihi }: { arsivTarihi?: string }) {
  const {
    loading,
    notFound,
    status,
    words,
    solved,
    allGroups,
    selected,
    mistakes,
    maxMistakes,
    message,
    shakeToken,
    submitting,
    showResult,
    toggle,
    submit,
    deselectAll,
    shuffle,
    dismissResult,
    openResult,
  } = useBaglamsal(arsivTarihi);

  if (loading) return <p className="px-4 py-16 text-center text-sm text-text-muted">Yükleniyor…</p>;
  if (notFound) return <p className="px-4 py-16 text-center text-sm text-text-muted">Bugün için bulmaca yok.</p>;

  const bitti = status !== "PLAYING";
  // Kaybedince kalan gruplar da gösteriliyor; kazanınca zaten hepsi çözülmüş.
  const gosterilecek = bitti && allGroups ? allGroups : solved;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3">
      <p className="text-center text-xs text-text-muted">Dörder kelimelik dört grup bul</p>

      <div className="flex flex-col gap-1.5">
        {gosterilecek.map((g) => (
          <div
            key={g.name}
            className="rounded-lg px-3 py-2 text-center"
            style={{ background: LEVEL_COLORS[g.level] }}
          >
            <p className="text-xs font-bold tracking-wide text-black uppercase">{g.name}</p>
            <p className="text-sm font-semibold text-black">{g.words.join(", ")}</p>
          </div>
        ))}
      </div>

      {!bitti && (
        <motion.div
          key={shakeToken}
          animate={shakeToken > 0 ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-4 gap-1.5"
        >
          {words.map((w) => {
            const secili = selected.includes(w);
            return (
              <button
                key={w}
                type="button"
                onClick={() => toggle(w)}
                disabled={submitting}
                className={cn(
                  "flex min-h-[56px] items-center justify-center rounded-lg border px-1 py-2 text-center text-[11px] leading-tight font-bold break-words sm:text-sm",
                  secili
                    ? "border-text-main bg-text-main text-background"
                    : "border-border-subtle bg-card text-text-main"
                )}
              >
                {w}
              </button>
            );
          })}
        </motion.div>
      )}

      <div className="flex min-h-[1.25rem] items-center justify-center">
        {message && <p className="text-sm font-semibold text-text-main">{message}</p>}
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-text-muted">Hata hakkı</span>
        {Array.from({ length: maxMistakes }, (_, i) => (
          <span
            key={i}
            /* Harcanmış hak SOLUK olmalı: Pop görünümünde border-subtle siyah,
               "bg-border-subtle" kullanılınca dolu ve boş nokta ayırt edilemiyordu. */
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              i < maxMistakes - mistakes ? "bg-text-main" : "bg-text-main/20"
            )}
          />
        ))}
      </div>

      {bitti ? (
        <button
          type="button"
          onClick={openResult}
          className="w-full rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black"
        >
          Sonucu göster
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={shuffle}
            className="flex-1 rounded-lg border border-border-subtle px-3 py-2.5 text-sm font-semibold text-text-main"
          >
            Karıştır
          </button>
          <button
            type="button"
            onClick={deselectAll}
            disabled={selected.length === 0}
            className="flex-1 rounded-lg border border-border-subtle px-3 py-2.5 text-sm font-semibold text-text-main disabled:opacity-40"
          >
            Temizle
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={selected.length !== 4 || submitting}
            className="flex-1 rounded-lg bg-accent-green px-3 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            Gönder
          </button>
        </div>
      )}

      {showResult && (
        <BaglamsalSonucModal
          won={status === "WON"}
          groups={gosterilecek}
          mistakes={mistakes}
          maxMistakes={maxMistakes}
          onClose={dismissResult}
        />
      )}
    </div>
  );
}

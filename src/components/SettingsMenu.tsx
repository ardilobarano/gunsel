"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Moon, Palette, Settings, X } from "lucide-react";
import FeedbackModal from "@/components/FeedbackModal";
import { getTheme, setTheme, subscribeToTheme } from "@/lib/theme";
import { DEFAULT_SKIN, DEFAULT_THEME, getSkin, setSkin, subscribeToSkin, type Skin } from "@/lib/skin";
import { cn } from "@/lib/utils";

function getServerTheme(): "dark" | "light" {
  return DEFAULT_THEME[DEFAULT_SKIN];
}

function getServerSkin(): Skin {
  return DEFAULT_SKIN;
}

const SKINS: { id: Skin; label: string }[] = [
  { id: "pop", label: "Pop" },
  { id: "klasik", label: "Klasik" },
];

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);
  const skin = useSyncExternalStore(subscribeToSkin, getSkin, getServerSkin);
  const isDark = theme === "dark";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Tercihler"
        aria-label="Tercihler"
        className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card hover:text-text-main"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Header'daki backdrop-blur, fixed konumlu elemanların referans noktasını
          header'a kaydırıyor — modal bu yüzden portal ile document.body'ye taşınıyor. */}
      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border-subtle bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-main">Tercihler</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="text-text-muted transition-colors hover:text-text-main"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Görünüm seçimi. Pop varsayılan; eski tasarım "Klasik" olarak duruyor,
                tek dokunuşla geri dönülebiliyor. Görünüm değişince o görünümün kendi
                varsayılan teması uygulanıyor (Pop açık, Klasik koyu için tasarlandı) —
                yoksa Klasik'e geçen biri açık temada beklemediği bir arayüz görürdü. */}
            <div className="mb-3 rounded-xl border border-border-subtle bg-background px-4 py-3">
              <div className="mb-2.5 flex items-center gap-3">
                <Palette className="h-5 w-5 text-text-muted" />
                <span className="text-sm font-semibold text-text-main">Görünüm</span>
              </div>
              <div className="flex gap-2">
                {SKINS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={skin === s.id}
                    onClick={() => {
                      if (s.id === skin) return;
                      setSkin(s.id);
                      setTheme(DEFAULT_THEME[s.id]);
                    }}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                      skin === s.id
                        ? "border-accent-green bg-accent-green text-black"
                        : "border-border-subtle text-text-muted hover:text-text-main"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-background px-4 py-3">
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5 text-text-muted" />
                <span className="text-sm font-semibold text-text-main">Koyu Tema</span>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  isDark ? "bg-accent-green" : "bg-card-hover"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white transition-all",
                    isDark ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>

            {/* Geri bildirim buraya konuldu: ayarlar ikonu her sayfanın header'ında
                olduğu için her yerden tek dokunuşla ulaşılıyor, ama header'a 4. bir
                ikon eklemeden. Önce bu modal kapatılıyor ki iki modal üst üste binmesin. */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFeedbackOpen(true);
              }}
              className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-background px-4 py-3 text-left transition-colors hover:bg-card-hover"
            >
              <MessageSquare className="h-5 w-5 shrink-0 text-text-muted" />
              <span className="text-sm font-semibold text-text-main">Geri Bildirim Gönder</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}

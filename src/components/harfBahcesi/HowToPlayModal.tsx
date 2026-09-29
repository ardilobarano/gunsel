"use client";

import { X } from "lucide-react";

interface HowToPlayModalProps {
  onClose: () => void;
}

const HEX_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
const EXAMPLE_LETTERS = ["G", "Ü", "N", "S", "E", "L", "İ"];

export default function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-subtle bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-bold text-text-main">Nasıl Oynanır?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="text-text-muted transition-colors hover:text-text-main"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 pb-5">
          <p className="text-sm text-text-muted">
            Verilen 7 harften en az 4 harfli kelimeler türet. Harfleri istediğin kadar tekrar
            kullanabilirsin.
          </p>

          <div className="flex justify-center gap-1">
            {EXAMPLE_LETTERS.map((letter, i) => (
              <div
                key={i}
                style={{ clipPath: HEX_CLIP }}
                className={`flex h-10 w-11 items-center justify-center text-sm font-bold ${
                  i === 3 ? "bg-accent-yellow text-black" : "bg-card-hover text-text-main"
                }`}
              >
                {letter}
              </div>
            ))}
          </div>

          <ul className="flex flex-col gap-2 text-sm text-text-main">
            <li className="flex items-start gap-3">
              <span
                style={{ clipPath: HEX_CLIP }}
                className="mt-0.5 h-5 w-6 shrink-0 bg-accent-yellow"
              />
              Sarı (ortadaki) harf her kelimede mutlaka olmalı.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-6 shrink-0 rounded-md bg-accent-green text-center text-xs font-bold leading-5 text-black">
                +7
              </span>
              7 harfin hepsini kullanan bir kelime bulursan (pangram) bonus puan kazanırsın.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-6 shrink-0 rounded-md border border-border-subtle bg-card-hover text-center text-xs font-bold leading-5 text-text-main">
                1+
              </span>
              4 harfli kelime 1 puan, daha uzunu harf sayısı kadar puan verir.
            </li>
          </ul>

          <p className="text-center text-xs text-text-muted">
            Toplam puanına göre Acemi&apos;den Kraliçe Arı&apos;ya kadar bir seviye kazanırsın.
          </p>
        </div>
      </div>
    </div>
  );
}

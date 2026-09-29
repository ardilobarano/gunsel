"use client";

import Link from "next/link";
import { X } from "lucide-react";

interface HowToPlayModalProps {
  onClose: () => void;
}

const EXAMPLE_TILES = [
  { letter: "K", className: "border-accent-green bg-accent-green text-black" },
  { letter: "E", className: "border-accent-yellow bg-accent-yellow text-black" },
  { letter: "L", className: "border-border-subtle bg-card-hover text-text-muted" },
];

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
            Gizli kelimeyi 6 denemede bulmaya çalış. Her tahminden sonra harflerin rengi değişir.
          </p>

          <div className="flex justify-center gap-1.5">
            {EXAMPLE_TILES.map((tile) => (
              <div
                key={tile.letter}
                className={`flex h-11 w-11 items-center justify-center rounded-md border-2 text-lg font-bold uppercase ${tile.className}`}
              >
                {tile.letter}
              </div>
            ))}
          </div>

          <ul className="flex flex-col gap-2 text-sm text-text-main">
            <li className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-md bg-accent-green" />
              Harf doğru yerde.
            </li>
            <li className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-md bg-accent-yellow" />
              Harf kelimede var, yeri yanlış.
            </li>
            <li className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-md border border-border-subtle bg-card-hover" />
              Harf kelimede yok.
            </li>
          </ul>

          <p className="text-center text-sm text-text-muted">
            <Link
              href="/kelimesel/ozel/olustur"
              className="font-medium text-accent-green underline-offset-2 hover:underline"
              onClick={onClose}
            >
              Google ile giriş yap
            </Link>{" "}
            ve kendi özel bulmacanı oluştur.
          </p>
        </div>
      </div>
    </div>
  );
}

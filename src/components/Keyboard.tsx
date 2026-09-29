"use client";

import type { LetterStatus } from "@/lib/kelimesel";
import { cn } from "@/lib/utils";

const ROW_1 = ["E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"];
const ROW_2 = ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"];
const ROW_3 = ["Z", "C", "V", "B", "N", "M", "Ö", "Ç"];

const STATUS_CLASSES: Record<LetterStatus | "default", string> = {
  default: "bg-card-hover text-text-main hover:bg-card-hover/70",
  correct: "bg-accent-green text-black",
  present: "bg-accent-yellow text-black",
  /* Sabit renk DEĞİL, token: doğru "elenmiş" tonu görünüme göre değişiyor.
     Eskiden bg-zinc-800 yazıyordu ve Pop'un koyu varyantında elenen harf
     varsayılan tuştan ayırt edilemiyordu (kullanıcı bildirdi): CSS'teki genel
     yama zinc-800'ü --muted-fill'e çeviriyordu, o da #3a3741 — varsayılan tuşun
     #322f38'ine neredeyse eşit. Yama açık tema için yazılmıştı, koyuda
     denenmemişti. */
  absent: "bg-key-absent text-text-muted",
};

interface KeyboardProps {
  statuses: Record<string, LetterStatus>;
  onKey: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}

function Key({
  label,
  wide,
  status,
  onClick,
}: {
  label: string;
  wide?: boolean;
  status: LetterStatus | "default";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // key-cap: Pop görünümünde tuşlara kalın kontur + sert gölge veriyor
        // (bkz. globals.css). Klasik görünümde bu sınıfın hiçbir etkisi yok.
        "key-cap flex h-12 items-center justify-center rounded-lg text-xs font-semibold transition-colors sm:text-sm",
        wide ? "min-w-[3rem] px-2 sm:min-w-[3.5rem]" : "w-7 sm:w-10",
        STATUS_CLASSES[status]
      )}
    >
      {label}
    </button>
  );
}

export default function Keyboard({ statuses, onKey, onEnter, onBackspace }: KeyboardProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-1.5 px-1">
      <div className="flex w-full justify-center gap-1">
        {ROW_1.map((letter) => (
          <Key
            key={letter}
            label={letter}
            status={statuses[letter] ?? "default"}
            onClick={() => onKey(letter)}
          />
        ))}
      </div>
      <div className="flex w-full justify-center gap-1">
        {ROW_2.map((letter) => (
          <Key
            key={letter}
            label={letter}
            status={statuses[letter] ?? "default"}
            onClick={() => onKey(letter)}
          />
        ))}
      </div>
      <div className="flex w-full justify-center gap-1">
        <Key label="ENTER" wide status="default" onClick={onEnter} />
        {ROW_3.map((letter) => (
          <Key
            key={letter}
            label={letter}
            status={statuses[letter] ?? "default"}
            onClick={() => onKey(letter)}
          />
        ))}
        <Key label="⌫" wide status="default" onClick={onBackspace} />
      </div>
    </div>
  );
}

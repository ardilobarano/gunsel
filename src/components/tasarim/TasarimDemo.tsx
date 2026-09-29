"use client";

import { useState } from "react";
import Link from "next/link";
import GazeteDemo from "./GazeteDemo";
import CiniDemo from "./CiniDemo";
import PopDemo from "./PopDemo";

type Yon = "gazete" | "cini" | "pop";
type Gorunum = "hub" | "game";

const YONLER: { id: Yon; ad: string; ozet: string; nokta: string }[] = [
  { id: "gazete", ad: "Gazete", ozet: "Kağıt zemin, serif başlıklar, mürekkep kırmızısı", nokta: "#8c1d18" },
  { id: "cini", ad: "Çini", ozet: "İznik kobaltı, lale motifi, turkuaz ve altın", nokta: "#3aa8a0" },
  { id: "pop", ad: "Pop", ozet: "Kalın konturlar, sert gölge, oyuna özel renk", nokta: "#ffd93d" },
];

export default function TasarimDemo() {
  const [yon, setYon] = useState<Yon>("gazete");
  const [gorunum, setGorunum] = useState<Gorunum>("hub");

  const aktif = YONLER.find((y) => y.id === yon)!;

  return (
    <div className="min-h-dvh bg-[#0a0a0a]">
      {/* Demo çerçevesi (nötr, tasarımların parçası değil) */}
      <div className="mx-auto max-w-md px-3 pt-4 pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-sm font-semibold text-zinc-100">Tasarım yönleri</h1>
          <Link href="/" className="text-[11px] text-zinc-500 underline-offset-2 hover:underline">
            mevcut tasarım →
          </Link>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{aktif.ozet}</p>
      </div>

      {/* Seçilen yön — telefonda gerçek uygulama gibi tam genişlikte */}
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-zinc-800">
        {yon === "gazete" && <GazeteDemo view={gorunum} />}
        {yon === "cini" && <CiniDemo view={gorunum} />}
        {yon === "pop" && <PopDemo view={gorunum} />}
      </div>

      {/* Alt kumanda */}
      <div className="sticky bottom-0 mt-3 border-t border-zinc-800 bg-[#0a0a0a]/95 px-3 pt-2 pb-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="flex gap-1.5">
            {YONLER.map((y) => (
              <button
                key={y.id}
                onClick={() => setYon(y.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                  yon === y.id
                    ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: y.nokta }} />
                {y.ad}
              </button>
            ))}
          </div>

          <div className="mt-1.5 flex gap-1.5">
            {(
              [
                ["hub", "Ana sayfa"],
                ["game", "Oyun ekranı"],
              ] as const
            ).map(([id, ad]) => (
              <button
                key={id}
                onClick={() => setGorunum(id)}
                className={`flex-1 rounded-lg border py-1.5 text-[11px] transition-colors ${
                  gorunum === id
                    ? "border-zinc-600 bg-zinc-800 text-zinc-200"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {ad}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

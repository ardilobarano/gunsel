"use client";

import { hsbToHex } from "@/lib/renksel";

/**
 * Ton / Doygunluk / Parlaklık kaydırıcıları.
 *
 * NEDEN HSB: insan rengi böyle hatırlıyor — "kırmızıya yakın, koyu, canlı".
 * RGB kaydırıcılarıyla akıldaki rengi bulmak deneme yanılma gerektiriyor,
 * oysa oyunun ölçtüğü şey hatırlama.
 *
 * Kaydırıcıların ZEMİNİ canlı: doygunluk çubuğu o anki tonun soluk-canlı
 * aralığını, parlaklık çubuğu siyah-renk aralığını gösteriyor. Düz gri
 * çubuklarla oyuncu nereye gittiğini ancak sürükleyerek anlıyordu.
 */
export default function RenkSecici({
  ton,
  doygunluk,
  parlaklik,
  onChange,
  disabled,
}: {
  ton: number;
  doygunluk: number;
  parlaklik: number;
  onChange: (t: number, d: number, p: number) => void;
  disabled?: boolean;
}) {
  const tonZemini =
    "linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)";
  const doygunlukZemini = `linear-gradient(to right, ${hsbToHex(ton, 0, parlaklik)}, ${hsbToHex(ton, 100, parlaklik)})`;
  const parlaklikZemini = `linear-gradient(to right, #000, ${hsbToHex(ton, doygunluk, 100)})`;

  const satirlar: [string, number, number, (v: number) => void, string][] = [
    ["Ton", ton, 360, (v) => onChange(v, doygunluk, parlaklik), tonZemini],
    ["Doygunluk", doygunluk, 100, (v) => onChange(ton, v, parlaklik), doygunlukZemini],
    ["Parlaklık", parlaklik, 100, (v) => onChange(ton, doygunluk, v), parlaklikZemini],
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      {satirlar.map(([ad, deger, en, ayarla, zemin]) => (
        <label key={ad} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs font-medium text-text-muted">{ad}</span>
          <input
            type="range"
            min={0}
            max={en}
            value={Math.round(deger)}
            disabled={disabled}
            onChange={(e) => ayarla(Number(e.target.value))}
            style={{ background: zemin }}
            className="renk-kaydirici h-3 min-w-0 flex-1 cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
      ))}
    </div>
  );
}

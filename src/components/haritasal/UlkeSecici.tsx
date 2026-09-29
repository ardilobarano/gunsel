"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { createPortal } from "react-dom";
import { useAcilisYonu } from "@/hooks/useAcilisYonu";
import { cn, trUpper } from "@/lib/utils";

interface Secenek {
  id: string;
  label: string;
}

/** Ülke arama kutusu. Liste zaten client'ta (ülke adları) — cevabı ele vermiyor,
 *  o yüzden Şarkısal/Karesel'deki gibi sunucu proxy'sine gerek yok.
 *
 *  PAS GEÇ YOK: Şarkısal'da pas geçmek daha uzun bir kesit, Karesel'de yeni bir
 *  kare açıyor — orada bir bedeli ve karşılığı var. Haritasal'da ipucu (uzaklık
 *  ve yön) yalnızca TAHMİNDEN doğuyor, dolayısıyla pas geçmek hakkı hiçbir şey
 *  almadan yakıyordu. */
export default function UlkeSecici({
  options,
  onSelect,
  disabled,
  ipucu,
}: {
  options: Secenek[];
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** Kutunun placeholder metni: sekmede ulke mi il mi arandigi degisiyor. */
  ipucu: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { kapsayiciRef, yukariAc, konum, olc } = useAcilisYonu(open);
  const listeRef = useRef<HTMLUListElement | null>(null);

  const sonuclar = useMemo(() => {
    const q = trUpper(query.trim());
    if (!q) return [];
    return options.filter((o) => trUpper(o.label).includes(q)).slice(0, 8);
  }, [query, options]);

  /* Liste yerlestikten sonra olculuyor: yukari mi asagi mi acilacagi ve ekran
     koordinati sonuc sayisina bagli. */
  useEffect(() => {
    if (sonuclar.length > 0) olc(220);
  }, [sonuclar.length, olc]);

  /* Sarkisal/Karesel ile AYNI davranis, ayni gerekcelerle:
     - onBlur ile kapatilmiyor, cunku telefonda klavyeyi kapatmak da odagi
       dusuruyor ve liste okunmadan yok oluyordu.
     - disari tiklama `click` ile dinleniyor, `pointerdown` ile degil: kaydirma
       da parmagi disari degdirmekle basliyor ve liste kaydirilir kaydirilmaz
       kapaniyordu. */
  useEffect(() => {
    if (!open) return;
    const disariTiklandi = (e: MouseEvent) => {
      const t = e.target as Node;
      if (kapsayiciRef.current?.contains(t) || listeRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("click", disariTiklandi);
    return () => document.removeEventListener("click", disariTiklandi);
  }, [open, kapsayiciRef]);

  return (
    <div className="flex w-full items-center gap-2">
      <div ref={kapsayiciRef} className="relative flex-1">
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-card px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            placeholder={ipucu}
            className="w-full bg-transparent text-sm text-text-main placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
          />
        </div>

        {/* Liste PORTAL ile body altina tasiniyor ve `fixed` konumlaniyor: kabin
            `overflow-y-auto`su onu kenarda kirpiyor, alttaki tanitim metni de
            uzerine biniyordu (gerekcesi useAcilisYonu icinde ayrintili yazili). */}
        {open && sonuclar.length > 0 && konum && createPortal(
          <ul
            ref={listeRef}
            style={{
              left: konum.sol,
              width: konum.genislik,
              ...(yukariAc
                ? { bottom: window.innerHeight - konum.ust + 4 }
                : { top: konum.alt + 4 }),
            }}
            className={cn(
              "fixed z-50 max-h-52 overflow-y-auto rounded-lg border border-border-subtle bg-card shadow-lg sm:max-h-72"
            )}
          >
            {sonuclar.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(o.id);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="flex w-full px-3 py-2 text-left text-sm text-text-main hover:bg-card-hover"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
      </div>

    </div>
  );
}

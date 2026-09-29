"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Check, Clapperboard, Globe, Grid3x3, Hexagon, Music, Scale, Type, type LucideIcon } from "lucide-react";
import { formatArsivTarihi } from "@/components/ArsivBanner";
import { isDoneOnDate } from "@/lib/storage";
import { getKelimeselGameId, MAX_LENGTH, MIN_LENGTH, type WordLength } from "@/lib/kelimesel";
import { getSarkisalGameId, SONG_CATEGORIES } from "@/lib/sarkisal";
import { DAHA_AZ_COK_CATEGORIES, getDahaAzCokGameId } from "@/lib/dahaAzCok";
import { cn } from "@/lib/utils";

/* Çok modlu oyunlarda günlük durum mod başına ayrı saklanıyor — hub'daki tik
   rozetiyle aynı kural: hepsi bitmişse "tamamlandı". */
const KELIMESEL_IDS = Array.from({ length: MAX_LENGTH - MIN_LENGTH + 1 }, (_, i) =>
  getKelimeselGameId((MIN_LENGTH + i) as WordLength)
);
const SARKISAL_IDS = SONG_CATEGORIES.map((c) => getSarkisalGameId(c.id));
const DAHA_AZ_COK_IDS = DAHA_AZ_COK_CATEGORIES.map((c) => getDahaAzCokGameId(c.id));

const OYUNLAR: { ad: string; href: string; icon: LucideIcon; ids: string[] }[] = [
  { ad: "Kelimesel", href: "/kelimesel", icon: Type, ids: KELIMESEL_IDS },
  { ad: "Şarkısal", href: "/sarkisal", icon: Music, ids: SARKISAL_IDS },
  { ad: "Harf Peteği", href: "/harf-bahcesi", icon: Hexagon, ids: ["harfBahcesi"] },
  { ad: "Daha Az / Daha Çok", href: "/daha-az-cok", icon: Scale, ids: DAHA_AZ_COK_IDS },
  { ad: "Karesel", href: "/karesel", icon: Clapperboard, ids: ["karesel"] },
  { ad: "Haritasal", href: "/haritasal", icon: Globe, ids: ["haritasal"] },
  { ad: "Bağlamsal", href: "/baglamsal", icon: Grid3x3, ids: ["baglamsal"] },
];

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function gunAdi(dateKey: string): string {
  return GUNLER[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
}

export default function ArsivListesi({ dates }: { dates: string[] }) {
  /* localStorage sunucuda yok: ilk render'da hepsi "yapılmadı" görünür, hydration
     sonrası gerçek durum gelir. Bu yüzden getServerSnapshot sabit false döndürüyor. */
  const durum = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(dates.map((d) => OYUNLAR.map((o) => o.ids.every((id) => isDoneOnDate(id, d))))),
    () => JSON.stringify(dates.map(() => OYUNLAR.map(() => false)))
  );
  const tablo = JSON.parse(durum) as boolean[][];

  return (
    <div className="flex flex-col gap-2.5">
      {dates.map((d, i) => (
        <div key={d} className="rounded-2xl border border-border-subtle bg-card px-4 py-3">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-text-main">{formatArsivTarihi(d)}</span>
            <span className="text-xs text-text-muted">{gunAdi(d)}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {OYUNLAR.map((o, j) => {
              const bitti = tablo[i]?.[j] ?? false;
              const Icon = o.icon;
              return (
                <Link
                  key={o.ad}
                  href={`${o.href}?tarih=${d}`}
                  title={`${o.ad} — ${formatArsivTarihi(d)}`}
                  aria-label={`${o.ad}, ${formatArsivTarihi(d)}${bitti ? " (tamamlandı)" : ""}`}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                    bitti
                      ? "border-accent-green bg-accent-green text-black"
                      : "border-border-subtle text-text-muted hover:text-text-main"
                  )}
                >
                  {bitti ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

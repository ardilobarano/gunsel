import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";

const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function formatArsivTarihi(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${d} ${AYLAR[m - 1]} ${y}`;
}

/**
 * Arşivden bir gün oynanırken üstte duran şerit. Amacı sadece süsleme değil:
 * oyuncu bugünün bulmacasını oynadığını sanmamalı — arşiv sonuçları seriye ve
 * istatistiklere sayılmıyor (bkz. storage.ts).
 */
export default function ArsivBanner({ tarih }: { tarih: string }) {
  return (
    <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-border-subtle bg-card px-3 py-2">
      <History className="h-4 w-4 shrink-0 text-text-muted" />
      <p className="min-w-0 flex-1 text-xs leading-tight text-text-muted">
        <span className="font-semibold text-text-main">Arşiv — {formatArsivTarihi(tarih)}</span>
        <br />
        Seriye ve istatistiklere sayılmaz.
      </p>
      <Link
        href="/arsiv"
        className="flex shrink-0 items-center gap-1 rounded-lg border border-border-subtle px-2 py-1 text-xs font-semibold text-text-main"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Arşiv
      </Link>
    </div>
  );
}

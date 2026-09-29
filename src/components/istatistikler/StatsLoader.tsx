"use client";

import dynamic from "next/dynamic";

// İstatistikler localStorage'dan okunuyor — sunucuda böyle bir veri yok, bu yüzden
// client-only yükleniyor (diğer oyun yükleyicileriyle aynı desen, hydration farkını önlüyor).
const StatsView = dynamic(() => import("./StatsView"), {
  ssr: false,
  loading: () => <p className="px-4 py-16 text-center text-sm text-text-muted">Yükleniyor…</p>,
});

export default function StatsLoader() {
  return <StatsView />;
}

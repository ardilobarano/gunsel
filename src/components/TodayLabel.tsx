"use client";

import dynamic from "next/dynamic";

// Tarih tarayıcının kendi saatine göre hesaplanıyor (bkz. TodayLabelContent) —
// sunucuda (Vercel, muhtemelen UTC) hesaplansaydı gece birkaç saat İstanbul'a
// göre yanlış gün gösterir, ayrıca sayfa statik ise build anında donardı.
const TodayLabelContent = dynamic(() => import("./TodayLabelContent"), { ssr: false });

export default function TodayLabel() {
  return <TodayLabelContent />;
}

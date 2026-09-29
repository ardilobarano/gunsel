"use client";

import dynamic from "next/dynamic";

const HarfBahcesiGame = dynamic(() => import("./HarfBahcesiGame"), { ssr: false });

export default function HarfBahcesiGameLoader({ arsivTarihi }: { arsivTarihi?: string }) {
  return <HarfBahcesiGame arsivTarihi={arsivTarihi} />;
}

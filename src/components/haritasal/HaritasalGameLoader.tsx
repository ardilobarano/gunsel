"use client";

import dynamic from "next/dynamic";

const HaritasalGame = dynamic(() => import("./HaritasalGame"), { ssr: false });

export default function HaritasalGameLoader({ arsivTarihi }: { arsivTarihi?: string }) {
  return <HaritasalGame arsivTarihi={arsivTarihi} />;
}

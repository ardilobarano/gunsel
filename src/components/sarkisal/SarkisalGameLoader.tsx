"use client";

import dynamic from "next/dynamic";

const SarkisalGame = dynamic(() => import("./SarkisalGame"), { ssr: false });

export default function SarkisalGameLoader({ arsivTarihi }: { arsivTarihi?: string }) {
  return <SarkisalGame arsivTarihi={arsivTarihi} />;
}

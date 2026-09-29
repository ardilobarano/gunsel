"use client";

import dynamic from "next/dynamic";

const BaglamsalGame = dynamic(() => import("./BaglamsalGame"), { ssr: false });

export default function BaglamsalGameLoader({ arsivTarihi }: { arsivTarihi?: string }) {
  return <BaglamsalGame arsivTarihi={arsivTarihi} />;
}

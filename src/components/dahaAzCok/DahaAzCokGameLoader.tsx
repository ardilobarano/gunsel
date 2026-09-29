"use client";

import dynamic from "next/dynamic";

const DahaAzCokGame = dynamic(() => import("./DahaAzCokGame"), { ssr: false });

export default function DahaAzCokGameLoader({ arsivTarihi }: { arsivTarihi?: string }) {
  return <DahaAzCokGame arsivTarihi={arsivTarihi} />;
}

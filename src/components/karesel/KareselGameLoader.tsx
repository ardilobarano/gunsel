"use client";

import dynamic from "next/dynamic";

const KareselGame = dynamic(() => import("./KareselGame"), { ssr: false });

export default function KareselGameLoader({ arsivTarihi }: { arsivTarihi?: string }) {
  return <KareselGame arsivTarihi={arsivTarihi} />;
}

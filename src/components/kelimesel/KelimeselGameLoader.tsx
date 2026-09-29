"use client";

import dynamic from "next/dynamic";

const KelimeselGame = dynamic(() => import("./KelimeselGame"), { ssr: false });

export default function KelimeselGameLoader({ arsivTarihi }: { arsivTarihi?: string }) {
  return <KelimeselGame arsivTarihi={arsivTarihi} />;
}

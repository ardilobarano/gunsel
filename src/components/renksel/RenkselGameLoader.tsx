"use client";

import dynamic from "next/dynamic";

const RenkselGame = dynamic(() => import("./RenkselGame"), { ssr: false });

export default function RenkselGameLoader({ arsivTarihi }: { arsivTarihi?: string }) {
  return <RenkselGame arsivTarihi={arsivTarihi} />;
}

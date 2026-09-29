"use client";

import dynamic from "next/dynamic";

const OzelKelimeselGame = dynamic(() => import("./OzelKelimeselGame"), { ssr: false });

export default function OzelKelimeselGameLoader({ shareCode }: { shareCode: string }) {
  return <OzelKelimeselGame shareCode={shareCode} />;
}

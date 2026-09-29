import { ogKart, OG_CONTENT_TYPE, OG_SIZE, OYUN_RENKLERI } from "@/lib/og";

export const alt = "Daha Az / Daha Çok — Günsel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogKart({ baslik: "Daha Az / Daha Çok", altBaslik: "Hangisi daha fazla?", renk: OYUN_RENKLERI.dahaAzCok });
}

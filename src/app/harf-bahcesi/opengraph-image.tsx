import { ogKart, OG_CONTENT_TYPE, OG_SIZE, OYUN_RENKLERI } from "@/lib/og";

export const alt = "Harf Peteği — Günsel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogKart({ baslik: "Harf Peteği", altBaslik: "Yedi harften kelime türet", renk: OYUN_RENKLERI.harfBahcesi });
}

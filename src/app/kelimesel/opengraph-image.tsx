import { ogKart, OG_CONTENT_TYPE, OG_SIZE, OYUN_RENKLERI } from "@/lib/og";

export const alt = "Kelimesel — Günsel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogKart({ baslik: "Kelimesel", altBaslik: "Günün kelimesini bul", renk: OYUN_RENKLERI.kelimesel });
}

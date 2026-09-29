import { ogKart, OG_CONTENT_TYPE, OG_SIZE, OYUN_RENKLERI } from "@/lib/og";

export const alt = "Haritasal — Günsel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogKart({ baslik: "Haritasal", altBaslik: "Ülkeyi siluetinden bul", renk: OYUN_RENKLERI.haritasal });
}

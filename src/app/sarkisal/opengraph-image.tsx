import { ogKart, OG_CONTENT_TYPE, OG_SIZE, OYUN_RENKLERI } from "@/lib/og";

export const alt = "Şarkısal — Günsel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogKart({ baslik: "Şarkısal", altBaslik: "Şarkıyı ilk saniyeden tanı", renk: OYUN_RENKLERI.sarkisal });
}

import { ogKart, OG_CONTENT_TYPE, OG_SIZE, OYUN_RENKLERI } from "@/lib/og";

export const alt = "Bağlamsal — Günsel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogKart({
    baslik: "Bağlamsal",
    altBaslik: "On altı kelime, dört gizli grup",
    renk: OYUN_RENKLERI.baglamsal,
  });
}

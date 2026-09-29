import { ogKart, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt = "Günsel — Günlük Türkçe Bulmaca Oyunları";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogKart({
    baslik: "Günlük Türkçe\nbulmacalar",
    altBaslik: "Beş oyun, her gün yenilenir",
  });
}

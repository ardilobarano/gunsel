import { ImageResponse } from "next/og";

/**
 * Paylaşım önizleme kartlarının ortak çizimi (WhatsApp/X/Instagram'da linkin altında
 * çıkan görsel). Pop görünümünün diliyle: krem zemin, kalın siyah kontur, blur'suz
 * sert gölge, oyuna özel doygun renk.
 *
 * next/og Satori kullanıyor: CSS grid YOK, birden fazla çocuğu olan her kutuda
 * display:flex AÇIKÇA yazılmalı — yoksa üretim sırasında hata verir.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const SIYAH = "#141414";
const KREM = "#f4f1e8";

/** Hub'daki kart renkleriyle aynı (bkz. GameCard). */
export const OYUN_RENKLERI = {
  kelimesel: "#ffd93d",
  sarkisal: "#ff8fab",
  harfBahcesi: "#9ae66e",
  dahaAzCok: "#7cc6fe",
  karesel: "#ffa552",
  haritasal: "#6ee7d7",
  baglamsal: "#c39bff",
} as const;

export function ogKart({
  baslik,
  altBaslik,
  renk = OYUN_RENKLERI.kelimesel,
}: {
  baslik: string;
  altBaslik: string;
  renk?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: KREM,
          padding: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: renk,
            border: `8px solid ${SIYAH}`,
            borderRadius: 32,
            boxShadow: `20px 20px 0 0 ${SIYAH}`,
            padding: "56px 56px 60px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                background: SIYAH,
                color: renk,
                borderRadius: 16,
                padding: "10px 22px",
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: -1,
              }}
            >
              GÜNSEL
            </div>
            <div style={{ display: "flex", fontSize: 30, color: SIYAH, opacity: 0.7 }}>gunsel.app</div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 700,
              color: SIYAH,
              letterSpacing: -3,
              marginTop: 34,
              lineHeight: 1.05,
            }}
          >
            {baslik}
          </div>

          <div style={{ display: "flex", fontSize: 38, color: SIYAH, opacity: 0.75, marginTop: 18 }}>
            {altBaslik}
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}

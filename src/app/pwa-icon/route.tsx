import { ImageResponse } from "next/og";

/**
 * "Ana ekrana ekle" simgesi (512x512).
 *
 * Neden ayrı bir route: icon.tsx tarayıcı sekmesi için 32x32 üretiyor; PWA
 * kurulum istemleri en az 192-512 arası bir simge bekliyor. Manifest'in
 * bildirdiği boyutla gerçek boyutun uyuşmaması bazı tarayıcılarda kurulum
 * istemini hiç göstermiyor.
 */
export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffd93d",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 400,
            height: 400,
            background: "#141414",
            borderRadius: 88,
            color: "#ffd93d",
            fontSize: 300,
            fontWeight: 700,
            letterSpacing: -12,
          }}
        >
          G
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}

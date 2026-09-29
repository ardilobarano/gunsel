import { ChevronDown, ChevronUp, Play, SkipBack, SkipForward } from "lucide-react";
import type { GameMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Hub kartlarındaki görsel önizlemeler — her oyunu okumadan tanıtmak için.
 * Açıklama metninin yerini aldılar: kart yüksekliği düştü, sayfa taranabilir hale geldi.
 * Tamamı CSS/ikon, görsel dosyası yok.
 */

const HEX_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

/** Kelimesel: yeşil/sarı/boş kutulardan oluşan mini tahta. */
function KelimeselPreview() {
  const rows = [
    ["empty", "present", "empty", "correct"],
    ["correct", "empty", "present", "empty"],
  ] as const;

  const cls = {
    correct: "bg-accent-green",
    present: "bg-accent-yellow",
    empty: "bg-background",
  };

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {/* onizleme-kare: Pop'ta kontur almasi icin kanca. Kelimesel'in karti
              SARI ve "yeri yanlis" karesi de sari — konturu olmadan kendi
              zemininde kayboluyor (bkz. globals.css). */}
          {row.map((state, j) => (
            <span
              key={j}
              className={cn("onizleme-kare h-7 w-7 rounded-md sm:h-8 sm:w-8", cls[state])}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Şarkısal: kısmen dolu ilerleme çubuğu + oynatma kontrolleri. */
function SarkisalPreview() {
  return (
    <div className="flex w-44 flex-col items-center gap-2.5 sm:w-52">
      <div className="h-2 w-full overflow-hidden rounded-full bg-background">
        <div className="h-full w-2/5 rounded-full bg-accent-green" />
      </div>
      <div className="flex items-center gap-4 text-text-main">
        <SkipBack className="h-4 w-4 fill-current" />
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-green text-black">
          <Play className="h-4 w-4 fill-current" />
        </span>
        <SkipForward className="h-4 w-4 fill-current" />
      </div>
    </div>
  );
}

/** Harf Peteği: sarı merkezli mini petek. */
function HarfBahcesiPreview() {
  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col gap-1">
        <span style={{ clipPath: HEX_CLIP }} className="h-7 w-8 bg-card-hover" />
        <span style={{ clipPath: HEX_CLIP }} className="h-7 w-8 bg-card-hover" />
      </div>
      <span
        style={{ clipPath: HEX_CLIP }}
        className="flex h-9 w-10 items-center justify-center bg-accent-yellow text-sm font-bold text-black"
      >
        A
      </span>
      <div className="flex flex-col gap-1">
        <span style={{ clipPath: HEX_CLIP }} className="h-7 w-8 bg-card-hover" />
        <span style={{ clipPath: HEX_CLIP }} className="h-7 w-8 bg-card-hover" />
      </div>
    </div>
  );
}

/** Daha Az / Daha Çok: yukarı yeşil, aşağı kırmızı ok. */
function DahaAzCokPreview() {
  return (
    <div className="flex items-center gap-5">
      <ChevronUp className="h-11 w-11 text-accent-green" strokeWidth={3} />
      <ChevronDown className="h-11 w-11 text-accent-red" strokeWidth={3} />
    </div>
  );
}

/**
 * Karesel: film şeridi — açılmış iki karede Cin Ali tarzı sade çizgi sahneler,
 * üçüncü kare henüz açılmamış. Çizimler inline SVG; görsel dosyası yok.
 */
function FrameScene({ children }: { children: React.ReactNode }) {
  return (
    /* onizleme-sahne: Pop'ta kutu koyulastiginca cizgilerin de renk degistirmesi
       icin kanca. Cizimler currentColor kullaniyor ve ustteki text-text-muted'i
       miras aliyor; koyu kutuda koyu cizgi gorunmez oluyordu. */
    <span className="onizleme-sahne flex h-10 w-14 items-center justify-center overflow-hidden rounded-md bg-card-hover">
      <svg viewBox="0 0 56 40" className="h-full w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function KareselPreview() {
  const cizgi = "currentColor";

  return (
    <div className="flex items-center gap-1.5 text-text-muted">
      {/* 1. kare: tepe, güneş ve yol */}
      <FrameScene>
        <circle cx="43" cy="11" r="5" stroke={cizgi} strokeWidth="1.6" />
        <path d="M2 31 L16 17 L27 31" stroke={cizgi} strokeWidth="1.6" />
        <path d="M22 31 L33 20 L44 31" stroke={cizgi} strokeWidth="1.6" />
        <path d="M0 31 H56" stroke={cizgi} strokeWidth="1.6" />
      </FrameScene>

      {/* 2. kare: Cin Ali tarzı çöp adam, elinde bir balon */}
      <FrameScene>
        <circle cx="22" cy="12" r="5" stroke={cizgi} strokeWidth="1.6" />
        <path d="M22 17 V27" stroke={cizgi} strokeWidth="1.6" />
        <path d="M22 20 L15 24 M22 20 L30 16" stroke={cizgi} strokeWidth="1.6" />
        <path d="M22 27 L17 34 M22 27 L27 34" stroke={cizgi} strokeWidth="1.6" />
        <path d="M30 16 L38 10" stroke={cizgi} strokeWidth="1.2" />
        <circle cx="41" cy="8" r="4" stroke={cizgi} strokeWidth="1.6" />
      </FrameScene>

      {/* 3. kare: henüz açılmadı */}
      <span className="flex h-10 w-14 items-center justify-center rounded-md border-2 border-dashed border-border-subtle text-lg font-bold text-text-muted">
        ?
      </span>
    </div>
  );
}

/** Türkiye silueti — Haritasal'ın ne olduğunu tek bakışta anlatıyor.
 *  Path, oyunun kendi verisinden (haritasalCountries.json) alınmış Türkiye kaydı;
 *  buraya SABİT kopyalandı ki 69 KB'lık ülke verisi hub'a yüklenmesin.
 *  Günün cevabını ele vermiyor — her gün aynı, sadece bir örnek. */
const TURKIYE_PATH =
  "M58.0 34.0L65.6 36.6L71.8 35.5L76.4 36.2L82.7 32.6L88.4 32.3L93.5 35.6L94.4 38.0L93.9 41.3L97.9 43.0L100.0 45.0L96.3 47.0L98.0 54.8L97.0 56.9L99.9 62.3L97.3 63.5L95.5 61.8L89.3 60.9L87.0 61.9L80.9 63.0L78.0 62.9L71.9 65.4L67.5 65.5L64.7 64.2L58.8 66.1L57.0 64.7L56.8 68.5L55.3 70.0L53.9 71.5L51.9 68.4L54.0 65.9L50.7 66.5L46.2 64.9L42.6 68.8L34.5 69.6L30.2 65.9L24.4 65.7L23.2 68.5L19.5 69.3L14.3 65.7L8.5 65.8L5.4 59.0L1.5 55.3L4.1 50.0L0.7 46.7L6.6 40.2L14.8 39.9L17.0 34.8L27.2 35.7L33.6 31.2L39.8 29.3L48.7 29.2L58.0 34.0ZM6.1 38.4L1.7 42.0L0.0 38.9L0.1 37.4L1.3 36.7L3.0 32.4L0.4 30.6L5.8 28.5L10.4 29.4L11.1 32.0L15.7 34.2L14.7 35.9L8.4 36.2L6.1 38.4Z";

function HaritasalPreview() {
  return (
    /* viewBox şeklin kendi sınırlarına kırpıldı: Türkiye yatay ve basık olduğu için
       0-100 kare kutuda ortada küçük bir şerit halinde kalıyordu. */
    <svg viewBox="0 27 100 46" className="h-16 w-auto" aria-hidden="true">
      <path d={TURKIYE_PATH} className="fill-text-main" />
    </svg>
  );
}

/** 4x4 ızgara; bir satır çözülmüş gibi renkli. Oyunun ne olduğunu tek bakışta
 *  anlatıyor, gerçek bulmacayla ilgisi yok. */
function BaglamsalPreview() {
  return (
    <div className="grid grid-cols-4 gap-1">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-4 w-8 rounded-sm",
            i < 4 ? "bg-accent-yellow" : i < 8 ? "bg-accent-green" : "bg-card-hover"
          )}
        />
      ))}
    </div>
  );
}

/** Renksel: eksik bölge + üç kaydırıcı. Kartın üstündeki her şey sabit koyu
 *  mürekkep olmali (bkz. CLAUDE.md, canli kart kurali). */
function RenkselPreview() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3">
      <div className="h-12 w-12 rounded-lg border-2 border-dashed border-black/40" />
      <div className="flex flex-col gap-1.5">
        {[0.75, 0.45, 0.6].map((oran, i) => (
          <div key={i} className="h-1.5 w-16 rounded-full bg-black/20">
            <div className="h-full rounded-full bg-black/60" style={{ width: oran * 64 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const PREVIEWS: Record<GameMeta["id"], () => React.JSX.Element> = {
  kelimesel: KelimeselPreview,
  sarkisal: SarkisalPreview,
  harfBahcesi: HarfBahcesiPreview,
  dahaAzCok: DahaAzCokPreview,
  karesel: KareselPreview,
  haritasal: HaritasalPreview,
  baglamsal: BaglamsalPreview,
  renksel: RenkselPreview,
};

export default function GamePreview({ gameId }: { gameId: GameMeta["id"] }) {
  const Preview = PREVIEWS[gameId];
  return <Preview />;
}

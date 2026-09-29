"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Clapperboard, Globe, Grid3x3, Hexagon, Music, Palette, Scale, Type, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { GameMeta } from "@/lib/types";
import GamePreview from "@/components/GamePreview";
import { areAllCompletedToday, isCompletedToday } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { getKelimeselGameId, MAX_LENGTH, MIN_LENGTH, type WordLength } from "@/lib/kelimesel";
import { getSarkisalGameId, SONG_CATEGORIES } from "@/lib/sarkisal";
import { DAHA_AZ_COK_CATEGORIES, getDahaAzCokGameId } from "@/lib/dahaAzCok";

const KELIMESEL_GAME_IDS = Array.from({ length: MAX_LENGTH - MIN_LENGTH + 1 }, (_, i) =>
  getKelimeselGameId((MIN_LENGTH + i) as WordLength)
);
const SARKISAL_GAME_IDS = SONG_CATEGORIES.map((category) => getSarkisalGameId(category.id));
const DAHA_AZ_COK_GAME_IDS = DAHA_AZ_COK_CATEGORIES.map((category) => getDahaAzCokGameId(category.id));

/**
 * Kelimesel (kelimesel-3..8), Şarkısal (sarkisal-tumu/pop/rap) ve Daha Az/Daha Çok
 * (dahaAzCok-nufus/imdb/spotify/fiyat/trivia) günlük durumu moda göre ayrı
 * depolandığından, tik ancak TÜM modlar bugün tamamlandıysa gösterilir.
 */
function checkCompletedToday(gameId: GameMeta["id"]): boolean {
  if (gameId === "kelimesel") return areAllCompletedToday(KELIMESEL_GAME_IDS);
  if (gameId === "sarkisal") return areAllCompletedToday(SARKISAL_GAME_IDS);
  if (gameId === "dahaAzCok") return areAllCompletedToday(DAHA_AZ_COK_GAME_IDS);
  return isCompletedToday(gameId);
}

function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getServerSnapshot(): boolean {
  return false;
}

const ICONS: Record<GameMeta["id"], LucideIcon> = {
  kelimesel: Type,
  sarkisal: Music,
  harfBahcesi: Hexagon,
  dahaAzCok: Scale,
  karesel: Clapperboard,
  haritasal: Globe,
  baglamsal: Grid3x3,
  renksel: Palette,
};

/**
 * Pop görünümünde her oyunun kendi rengi var — kart tamamen o renge boyanıyor
 * (bkz. globals.css'teki .game-surface). Klasik görünümde bu değişken hiç
 * okunmuyor, kart eskisi gibi bg-card kalıyor.
 */
const GAME_COLORS: Record<GameMeta["id"], string> = {
  /* Kart sarısı, oyunun "harf var ama yeri yanlış" sarısından (--accent-yellow,
     #ffd93d) BİLEREK daha koyu. Eskiden ikisi birebir aynı hex'ti ve
     önizlemedeki o kareler kartın içinde tamamen kayboluyordu (kullanıcı
     bildirdi: 8 kareden 6'sı görünüyordu). Düzeltilen kare değil kart — kare
     rengi oyunun gerçek geri bildirim rengi, değiştirilirse thumbnail oyunu
     yanlış tanıtır. Aynı ailede kaldığı için Kelimesel'in sarı kimliği duruyor. */
  kelimesel: "#ddab00",
  sarkisal: "#ff8fab",
  harfBahcesi: "#9ae66e",
  dahaAzCok: "#7cc6fe",
  karesel: "#ffa552",
  haritasal: "#6ee7d7",
  baglamsal: "#c39bff",
  renksel: "#ff7a6b",
};

const ACCENT_CLASSES: Record<GameMeta["accent"], string> = {
  green: "text-accent-green",
  yellow: "text-accent-yellow",
  red: "text-accent-red",
};

export default function GameCard({ game }: { game: GameMeta }) {
  const Icon = ICONS[game.id];
  const completed = useSyncExternalStore(
    subscribeToStorage,
    () => checkCompletedToday(game.id),
    getServerSnapshot
  );

  return (
    // Görsel önizleme ekran okuyucu için anlamsız olduğundan, kaldırılan açıklama
    // metni burada aria-label olarak yaşamaya devam ediyor — görme engelli bir
    // kullanıcı yine "Kelimesel — 3-8 harf arasında..." duyuyor.
    <Link
      href={game.href}
      className="block"
      aria-label={`${game.name} — ${game.description}${completed ? " (bugün tamamlandı)" : ""}`}
    >
      {/* Açıklama metni yerine görsel önizleme: oyun okumadan tanınıyor, kart
          kısalıyor ve tek sütunda taranabilir bir liste oluyor (lessgames deseni). */}
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15 }}
        style={{ ["--game-color" as string]: GAME_COLORS[game.id] }}
        /* Masaüstünde kart biraz daha büyük: üç sütuna geçince tek tek
           küçüldükleri için iç boşluk artırıldı, yoksa ızgara cılız duruyor. */
        className="game-surface relative flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-card px-5 py-5 transition-colors hover:bg-card-hover lg:gap-4 lg:px-6 lg:py-7"
      >
        {completed && (
          <span
            className="game-done absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-accent-green/15 text-accent-green"
            title="Bugün tamamlandı"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}

        <h3 className="flex items-center gap-2 text-xl font-bold text-text-main">
          <Icon className={cn("h-5 w-5", ACCENT_CLASSES[game.accent])} strokeWidth={2} />
          {game.name}
        </h3>

        <div aria-hidden="true">
          <GamePreview gameId={game.id} />
        </div>
      </motion.div>
    </Link>
  );
}

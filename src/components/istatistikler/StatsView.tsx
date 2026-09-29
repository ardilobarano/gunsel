"use client";

import Link from "next/link";
import { Clapperboard, Globe, Grid3x3, Hexagon, Music, Palette, Scale, Type, type LucideIcon } from "lucide-react";
import {
  getDahaAzCokStats,
  getHarfBahcesiStats,
  getBaglamsalStats,
  getHaritasalStats,
  getKareselStats,
  getRenkselStats,
  getKelimeselStats,
  getSarkisalStats,
  type BaseStats,
} from "@/lib/stats";
import { getKelimeselGameId, getMaxAttempts, MAX_LENGTH, MIN_LENGTH, type WordLength } from "@/lib/kelimesel";
import { getSarkisalGameId, MAX_ATTEMPTS as SARKISAL_ATTEMPTS, SONG_CATEGORIES, STAGE_SECONDS } from "@/lib/sarkisal";
import { DAHA_AZ_COK_CATEGORIES, getDahaAzCokGameId, MAX_STEPS } from "@/lib/dahaAzCok";
import { GAME_ID as HARF_BAHCESI_ID } from "@/lib/harfBahcesi";
import { GAME_ID as RENKSEL_ID, TUR_PUANI as RENKSEL_PUAN } from "@/lib/renksel";
import {
  getHaritasalGameId,
  HARITASAL_KATEGORILERI,
  MAX_ATTEMPTS as HARITASAL_ATTEMPTS,
} from "@/lib/haritasal";
import { GAME_ID as BAGLAMSAL_ID } from "@/lib/baglamsal";
import {
  getKareselGameId,
  KARESEL_KATEGORILERI,
  MAX_ATTEMPTS as KARESEL_ATTEMPTS,
} from "@/lib/karesel";
import { cn } from "@/lib/utils";

const KELIMESEL_IDS = Array.from({ length: MAX_LENGTH - MIN_LENGTH + 1 }, (_, i) =>
  getKelimeselGameId((MIN_LENGTH + i) as WordLength)
);
const SARKISAL_IDS = SONG_CATEGORIES.map((c) => getSarkisalGameId(c.id));
const DAHA_AZ_COK_IDS = DAHA_AZ_COK_CATEGORIES.map((c) => getDahaAzCokGameId(c.id));
const HARITASAL_IDS = HARITASAL_KATEGORILERI.map((k) => getHaritasalGameId(k.id));
const KARESEL_IDS = KARESEL_KATEGORILERI.map((k) => getKareselGameId(k.id));

function StatNumber({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="text-xl font-bold text-text-main tabular-nums">{value}</span>
      <span className="text-center text-[11px] leading-tight text-text-muted">{label}</span>
    </div>
  );
}

function BaseRow({ stats }: { stats: BaseStats }) {
  return (
    <div className="flex gap-2">
      <StatNumber label="Oynanan" value={stats.played} />
      <StatNumber label="Kazanma %" value={stats.winRate} />
      <StatNumber label="Güncel seri" value={stats.currentStreak} />
      <StatNumber label="En uzun seri" value={stats.maxStreak} />
    </div>
  );
}

/** Yatay çubuk grafik — en çok tekrar edene göre orantılı. */
function Distribution({
  distribution,
  labelOf,
}: {
  distribution: number[];
  labelOf: (index: number) => string;
}) {
  const max = Math.max(...distribution, 1);
  const hasAny = distribution.some((n) => n > 0);

  if (!hasAny) {
    return <p className="text-xs text-text-muted">Henüz kazanılmış oyun yok.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {distribution.map((count, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-text-muted">
            {labelOf(i)}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-card-hover">
            <div
              className={cn("h-full rounded-sm bg-accent-green transition-all", count === 0 && "bg-transparent")}
              style={{ width: `${(count / max) * 100}%`, minWidth: count > 0 ? "1.25rem" : 0 }}
            />
          </div>
          <span className="w-6 shrink-0 text-[11px] tabular-nums text-text-muted">{count}</span>
        </div>
      ))}
    </div>
  );
}

function GameCard({
  name,
  href,
  icon: Icon,
  accent,
  children,
}: {
  name: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-card p-4">
      <Link href={href} className="mb-3 flex items-center gap-2 hover:opacity-80">
        <Icon className={cn("h-5 w-5", accent)} strokeWidth={1.75} />
        <h2 className="text-base font-semibold text-text-main">{name}</h2>
      </Link>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export default function StatsView() {
  const kelimesel = getKelimeselStats(KELIMESEL_IDS, getMaxAttempts());
  const sarkisal = getSarkisalStats(SARKISAL_IDS, SARKISAL_ATTEMPTS);
  const karesel = getKareselStats(KARESEL_IDS, KARESEL_ATTEMPTS);
  const haritasal = getHaritasalStats(HARITASAL_IDS, HARITASAL_ATTEMPTS);
  const renksel = getRenkselStats(RENKSEL_ID, RENKSEL_PUAN);
  const baglamsal = getBaglamsalStats(BAGLAMSAL_ID);
  const harfBahcesi = getHarfBahcesiStats(HARF_BAHCESI_ID);
  const dahaAzCok = getDahaAzCokStats(DAHA_AZ_COK_IDS);

  const toplamOyun =
    kelimesel.played + sarkisal.played + karesel.played + haritasal.played + baglamsal.played + harfBahcesi.played + dahaAzCok.played + renksel.played;

  if (toplamOyun === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-sm text-text-muted">
          Henüz tamamlanmış bir oyunun yok. Bir bulmaca çöz, istatistiklerin burada birikmeye başlasın.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          Oyunlara git
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-10">
      <GameCard name="Kelimesel" href="/kelimesel" icon={Type} accent="text-accent-green">
        <BaseRow stats={kelimesel} />
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Kaçıncı denemede bildin
          </p>
          <Distribution distribution={kelimesel.distribution} labelOf={(i) => `${i + 1}.`} />
        </div>
      </GameCard>

      <GameCard name="Şarkısal" href="/sarkisal" icon={Music} accent="text-accent-yellow">
        <BaseRow stats={sarkisal} />
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Kaç saniye dinleyip bildin
          </p>
          <Distribution
            distribution={sarkisal.distribution}
            labelOf={(i) => `${STAGE_SECONDS[i] ?? "?"}sn`}
          />
        </div>
      </GameCard>

      <GameCard name="Karesel" href="/karesel" icon={Clapperboard} accent="text-accent-yellow">
        <BaseRow stats={karesel} />
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Kaç karede bildin
          </p>
          <Distribution distribution={karesel.distribution} labelOf={(i) => `${i + 1}. kare`} />
        </div>
      </GameCard>

      <GameCard name="Renksel" href="/renksel" icon={Palette} accent="text-accent-red">
        <BaseRow stats={renksel} />
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
            Aldığın puan
          </p>
          <Distribution distribution={renksel.distribution} labelOf={(i) => `${i + 1}`} />
        </div>
      </GameCard>

      <GameCard name="Haritasal" href="/haritasal" icon={Globe} accent="text-accent-green">
        <BaseRow stats={haritasal} />
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
            Kaç tahminde bildin
          </p>
          <Distribution distribution={haritasal.distribution} labelOf={(i) => `${i + 1}.`} />
        </div>
      </GameCard>

      <GameCard name="Bağlamsal" href="/baglamsal" icon={Grid3x3} accent="text-accent-yellow">
        <BaseRow stats={baglamsal} />
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
            Kaç hatayla bitirdin
          </p>
          <Distribution distribution={baglamsal.distribution} labelOf={(i) => `${i} hata`} />
        </div>
      </GameCard>

      <GameCard name="Harf Peteği" href="/harf-bahcesi" icon={Hexagon} accent="text-accent-green">
        <BaseRow stats={harfBahcesi} />
        <div className="flex gap-2 border-t border-border-subtle pt-3">
          <StatNumber label="Toplam kelime" value={harfBahcesi.totalWords} />
          <StatNumber label="Bir gündeki en çok" value={harfBahcesi.bestWordCount} />
        </div>
      </GameCard>

      <GameCard name="Daha Az / Daha Çok" href="/daha-az-cok" icon={Scale} accent="text-accent-red">
        <BaseRow stats={dahaAzCok} />
        <div className="flex gap-2 border-t border-border-subtle pt-3">
          <StatNumber label="Ortalama doğru" value={`${dahaAzCok.averageCorrect}/${MAX_STEPS}`} />
          <StatNumber label="En iyi" value={`${dahaAzCok.bestCorrect}/${MAX_STEPS}`} />
          <StatNumber label="Toplam tur" value={dahaAzCok.totalRounds} />
        </div>
      </GameCard>

      <p className="px-1 text-center text-xs leading-relaxed text-text-muted">
        İstatistikler bu cihazda saklanıyor — başka bir telefonda ya da tarayıcı verisi
        temizlendiğinde görünmez.
      </p>
    </div>
  );
}

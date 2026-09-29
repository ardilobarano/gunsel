import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { isAdmin } from "@/lib/admin.server";
import { MAX_LENGTH, MIN_LENGTH, type WordLength } from "@/lib/kelimesel";
import { getDailyWord, getServerTodayKey } from "@/lib/kelimesel.server";
import { SONG_CATEGORIES } from "@/lib/sarkisal";
import { getDailyChallenge } from "@/lib/sarkisal.server";
import { getDailyPuzzle, getMaxScore } from "@/lib/harfBahcesi";
import { DAHA_AZ_COK_CATEGORIES } from "@/lib/dahaAzCok";
import { getDailySequence } from "@/lib/dahaAzCok.server";
import { getDailyMovie } from "@/lib/karesel.server";
import { getFrameUrl } from "@/lib/karesel";
import { prisma } from "@/lib/prisma";

// Cevapları gösteren bir sayfa — asla önbelleğe alınmamalı ve indekslenmemeli.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-card p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-text-main">
        {value}
      </span>
    </div>
  );
}

export default async function OnizlemePage({
  searchParams,
}: {
  searchParams: Promise<{ tarih?: string }>;
}) {
  if (!(await isAdmin())) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-lg font-bold text-text-main">Bu sayfa özel</h1>
          <p className="text-sm text-text-muted">
            Önizleme yalnızca yetkili hesaplara açık. Yetkili hesabınla giriş
            yaptığından emin ol.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-accent-green hover:underline"
          >
            Anasayfaya dön
          </Link>
        </main>
      </div>
    );
  }

  const today = getServerTodayKey();
  const requested = (await searchParams).tarih;
  // Varsayılan YARIN — bu sayfanın asıl amacı yarının içeriğini bugünden görmek.
  const dateKey =
    requested && DATE_RE.test(requested) ? requested : shiftDate(today, 1);

  const lengths = Array.from(
    { length: MAX_LENGTH - MIN_LENGTH + 1 },
    (_, i) => (MIN_LENGTH + i) as WordLength,
  );
  const harfBahcesi = getDailyPuzzle(dateKey);
  // Önizleme Karesel'in Film sekmesini gösteriyor; Dizi sekmesi ayrı havuz.
  const movie = getDailyMovie(dateKey, "film");
  const dahaAzCokSequences = await Promise.all(
    DAHA_AZ_COK_CATEGORIES.map(async (category) => ({
      category,
      sequence: await getDailySequence(dateKey, category.id),
    })),
  );

  // Geri bildirimler tarihe bağlı değil — hangi güne bakılırsa bakılsın en son gelenler.
  const feedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { email: true, name: true } } },
  });

  const dayOffset = Math.round(
    (Date.UTC(...(dateKey.split("-").map(Number) as [number, number, number])) -
      Date.UTC(...(today.split("-").map(Number) as [number, number, number]))) /
      86400000,
  );
  const offsetLabel =
    dayOffset === 0
      ? "bugün"
      : dayOffset === 1
        ? "yarın"
        : dayOffset > 0
          ? `${dayOffset} gün sonra`
          : `${-dayOffset} gün önce`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/onizleme?tarih=${shiftDate(dateKey, -1)}`}
            className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-main hover:bg-card-hover"
          >
            ‹ Önceki
          </Link>
          <div className="text-center">
            <p className="text-sm font-bold text-text-main">
              {formatDateLabel(dateKey)}
            </p>
            <p className="text-xs text-text-muted">
              {dateKey} · {offsetLabel}
            </p>
          </div>
          <Link
            href={`/onizleme?tarih=${shiftDate(dateKey, 1)}`}
            className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-main hover:bg-card-hover"
          >
            Sonraki ›
          </Link>
        </div>

        <Section title="Kelimesel">
          {lengths.map((length) => (
            <Row
              key={length}
              label={`${length} harf`}
              value={getDailyWord(dateKey, length) || "—"}
            />
          ))}
        </Section>

        <Section title="Şarkısal">
          {SONG_CATEGORIES.map((category) => {
            const challenge = getDailyChallenge(dateKey, category.id);
            return (
              <div
                key={category.id}
                className="border-b border-border-subtle py-2 last:border-b-0"
              >
                <Row
                  label={category.label}
                  value={
                    challenge
                      ? `${challenge.title} — ${challenge.artist}`
                      : "içerik yok"
                  }
                />
                {challenge && (
                  <audio
                    controls
                    preload="none"
                    src={challenge.audioUrl}
                    className="mt-2 h-8 w-full"
                  />
                )}
              </div>
            );
          })}
        </Section>

        <Section title="Karesel">
          {movie ? (
            <>
              <Row
                label="Film"
                value={`${movie.title}${movie.year ? ` (${movie.year})` : ""}`}
              />
              {movie.originalTitle !== movie.title && (
                <Row label="Orijinal" value={movie.originalTitle} />
              )}
              <div className="mt-3 flex gap-1 overflow-x-auto">
                {movie.frames.map((frame, i) => (
                  <div key={frame} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getFrameUrl(frame)}
                      alt=""
                      className="h-16 w-28 rounded-md object-cover"
                    />
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">içerik yok</p>
          )}
        </Section>

        <Section title="Harf Peteği">
          <Row label="Harfler" value={harfBahcesi.letters.join(" ")} />
          <Row label="Merkez" value={harfBahcesi.centerLetter} />
          <Row label="Kelime sayısı" value={harfBahcesi.validWords.length} />
          <Row label="Maks. puan" value={getMaxScore(harfBahcesi)} />
          <Row label="Pangram" value={harfBahcesi.pangrams.join(", ")} />
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-text-muted hover:text-text-main">
              Tüm kelimeleri göster
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-text-main">
              {[...harfBahcesi.validWords].sort().join(", ")}
            </p>
          </details>
        </Section>

        <Section title={`Geri Bildirimler (${feedbacks.length})`}>
          {feedbacks.length === 0 ? (
            <p className="text-sm text-text-muted">Henüz geri bildirim yok.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="rounded-lg border border-border-subtle bg-background p-3"
                >
                  <p className="whitespace-pre-wrap text-sm text-text-main">
                    {fb.message}
                  </p>
                  <p className="mt-2 text-xs text-text-muted">
                    {new Date(fb.createdAt).toLocaleString("tr-TR")}
                    {fb.page ? ` · ${fb.page}` : ""}
                    {fb.contact ? ` · ${fb.contact}` : ""}
                    {fb.user?.email ? ` · ${fb.user.email}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Daha Az / Daha Çok">
          {dahaAzCokSequences.map(({ category, sequence }) => (
            <details
              key={category.id}
              className="border-b border-border-subtle py-2 last:border-b-0"
            >
              <summary className="cursor-pointer text-sm font-medium text-text-main">
                {category.label}{" "}
                <span className="text-xs font-normal text-text-muted">
                  {sequence ? `(${sequence.length} öğe)` : "(içerik yok)"}
                </span>
              </summary>
              {sequence && (
                <ol className="mt-2 list-decimal pl-5 text-xs text-text-muted">
                  {sequence.map((item) => (
                    <li key={item.id}>
                      {item.label} —{" "}
                      <span className="text-text-main">
                        {item.value.toLocaleString("tr-TR")} {item.unit}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </details>
          ))}
        </Section>
      </main>
    </div>
  );
}

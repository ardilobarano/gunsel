import type { Metadata } from "next";
import { History, UserRound } from "lucide-react";
import Header from "@/components/Header";
import ArsivListesi from "@/components/arsiv/ArsivListesi";
import {
  ARCHIVE_DAYS,
  getArchiveDates,
  getServerTodayKey,
} from "@/lib/arsiv.server";
import { auth, signIn } from "@/../auth";

export const metadata: Metadata = {
  title: "Arşiv — Günsel",
  description: "Kaçırdığın günlerin bulmacalarını oyna.",
};

/* Oturuma bakıyor, önbelleğe alınmamalı. */
export const dynamic = "force-dynamic";

export default async function ArsivPage() {
  const session = await auth();
  const todayKey = getServerTodayKey();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <div className="mb-5 text-center">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-text-main">
            <History className="h-6 w-6 text-text-muted" />
            Arşiv
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Son {ARCHIVE_DAYS} günün bulmacaları
          </p>
        </div>

        {session?.user ? (
          <ArsivListesi dates={getArchiveDates(todayKey)} />
        ) : (
          /* Giriş yoksa arşiv içeriği hiç render EDİLMİYOR — tarih listesi bile
             basılmıyor. Asıl kilit sunucu API'lerinde (bkz. arsiv.server.ts), burası
             sadece "neden giriş gerekiyor"u anlatan yüz. */
          <div className="rounded-2xl border border-border-subtle bg-card px-5 py-8 text-center">
            <p className="text-sm leading-relaxed text-text-main">
              Geçmiş günlerin bulmacaları giriş yapan oyunculara açık.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              Arşivde oynadıkların serini ve istatistiklerini etkilemez — günlük
              bulmaca ayrı kalır.
            </p>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/arsiv" });
              }}
            >
              <button
                type="submit"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-green px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                <UserRound className="h-4 w-4" />
                Google ile giriş yap
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

import Header from "@/components/Header";
import StatsLoader from "@/components/istatistikler/StatsLoader";

export default function IstatistiklerPage() {
  return (
    /* Oyun sayfalarının aksine burası KAYDIRILABİLİR (h-dvh değil) — beş oyunun
       kartları bir ekrana sığmaz ve burada kaydırma normal, oyun akışını bozmuyor. */
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <h1 className="pt-4 pb-3 text-center text-xl font-bold text-text-main sm:pt-6 sm:pb-4">
          İstatistikler
        </h1>
        <StatsLoader />
      </main>
    </div>
  );
}

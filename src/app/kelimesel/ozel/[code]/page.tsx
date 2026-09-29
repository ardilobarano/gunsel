import Header from "@/components/Header";
import OzelKelimeselGameLoader from "@/components/kelimesel/OzelKelimeselGameLoader";

export default async function OzelKelimeselPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    /* Günlük Kelimesel ile aynı yaklaşım: sayfa ekran yüksekliğine sabitleniyor ki
       WordGrid kalan yeri ölçüp kutuları ona göre boyutlandırabilsin. */
    <div className="flex h-dvh flex-col overflow-y-auto bg-background">
      <Header />
      <main className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col">
        <h1 className="pt-3 pb-2 text-center text-xl font-bold text-text-main sm:pt-6 sm:pb-4">
          Özel Kelimesel
        </h1>
        <OzelKelimeselGameLoader shareCode={code} />
      </main>
    </div>
  );
}

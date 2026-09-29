import Header from "@/components/Header";
import { auth, signIn } from "@/../auth";
import OzelBulmacaOlustur from "@/components/kelimesel/OzelBulmacaOlustur";

export default async function OzelBulmacaOlusturPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        <h1 className="pb-4 text-center text-xl font-bold text-text-main">Özel Kelimesel Oluştur</h1>
        {session?.user ? (
          <OzelBulmacaOlustur />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <p className="text-sm text-text-muted">
              Özel bulmaca oluşturmak için Google ile giriş yapman gerekiyor.
            </p>
            <form
              action={async () => {
                "use server";
                await signIn("google");
              }}
            >
              <button
                type="submit"
                className="rounded-lg bg-accent-green px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Google ile giriş yap
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

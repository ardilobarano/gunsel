import { LogOut, UserRound } from "lucide-react";
import { auth, signIn, signOut } from "@/../auth";

export default async function AuthButton() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button
          type="submit"
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-text-muted transition-colors hover:bg-card hover:text-text-main"
        >
          <UserRound className="h-4 w-4" />
          Giriş yap
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {session.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.user.image}
          alt={session.user.name ?? "Profil"}
          title={session.user.name ?? undefined}
          className="h-8 w-8 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-text-muted"
          title={session.user.name ?? undefined}
        >
          <UserRound className="h-4 w-4" />
        </span>
      )}
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button
          type="submit"
          aria-label="Çıkış yap"
          title="Çıkış yap"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card hover:text-text-main"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h1 className="text-2xl font-bold text-text-main">{title}</h1>
      <p className="text-sm text-text-muted">Bu oyun yakında burada olacak.</p>
      <Link
        href="/"
        className="mt-2 flex items-center gap-1 text-sm font-medium text-accent-green hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Ana sayfaya dön
      </Link>
    </div>
  );
}

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { SAYFA_KABI } from "@/lib/duzen";
import AuthButton from "@/components/AuthButton";
import { cn } from "@/lib/utils";
import SettingsMenu from "@/components/SettingsMenu";

/**
 * @param buyukLogo Logoyu büyütür ve başlıkta ORTALAR — SADECE hub'da.
 *
 * Neden her sayfada değil: büyük logo başlığı 69px'ten 136px'e çıkarıyor ve
 * başlık `sticky`. Oyun sayfalarında bu, ekranın üst kısmını kalıcı olarak
 * yiyor; Kelimesel'in ızgarası aşağı taşıp kesiliyordu. Hub'da ise sayfanın
 * kendisi bir vitrin olduğu için büyük logo yerinde duruyor.
 */
export default function Header({ buyukLogo = false }: { buyukLogo?: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border-subtle bg-background/90 backdrop-blur">
      {/* Kabın genişliği hub ızgarasıyla ORTAK (`SAYFA_KABI`).
          Büyük logo halinde düzen ÜÇ SÜTUNLU ızgaraya dönüyor: boş | logo |
          ikonlar. `justify-between` ile ortalamak İŞE YARAMAZDI — logo, sağdaki
          ikon öbeğinin genişliği kadar sola kayıyordu. Eşit genişlikte iki yan
          sütun (1fr) logoyu kabın GERÇEK ortasına oturtuyor. */}
      <div
        className={cn(
          SAYFA_KABI,
          "flex items-center justify-between px-4 py-4",
          buyukLogo && "lg:grid lg:grid-cols-[1fr_auto_1fr]"
        )}
      >
        {/* Yalnızca ızgarayı dengeleyen boş sütun. */}
        {buyukLogo && <div aria-hidden="true" className="hidden lg:block" />}

        <Link
          href="/"
          className={cn("flex items-center gap-2", buyukLogo && "lg:justify-self-center")}
        >
          {/* Büyük halde logo, ızgaranın İLK KARTI kadar geniş duruyor.
              Punto `globals.css`'teki `.logo-buyuk`ta — görünüme göre değişmesi
              gerektiği için (iki görünüm farklı yazı tipi kullanıyor) ve
              bileşenin görünümden habersiz kalması kuralı için orada. */}
          <span
            className={cn(
              "text-2xl font-bold tracking-tight text-text-main",
              buyukLogo && "logo-buyuk"
            )}
          >
            Gün<span className="text-accent-green">sel</span>
          </span>
        </Link>

        <div className={cn("flex items-center gap-1", buyukLogo && "lg:justify-self-end")}>
          <Link
            href="/istatistikler"
            title="İstatistikler"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card hover:text-text-main"
          >
            <BarChart3 className="h-5 w-5" />
          </Link>
          <AuthButton />
          <SettingsMenu />
        </div>
      </div>
    </header>
  );
}

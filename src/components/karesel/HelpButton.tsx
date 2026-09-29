"use client";

import { HelpCircle } from "lucide-react";
import HowToPlayModal from "@/components/karesel/HowToPlayModal";
import { useFirstVisitHelp } from "@/hooks/useFirstVisitHelp";

export default function HelpButton() {
  // Oyuna ilk kez girildiğinde pencere kendiliğinden açılıyor (bkz. useFirstVisitHelp).
  const { open, openHelp, closeHelp } = useFirstVisitHelp("karesel");

  return (
    <>
      <button
        type="button"
        onClick={openHelp}
        aria-label="Nasıl oynanır?"
        className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card hover:text-text-main"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {open && <HowToPlayModal onClose={closeHelp} />}
    </>
  );
}

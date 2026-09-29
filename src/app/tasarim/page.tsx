import type { Metadata } from "next";
import { Outfit, Playfair_Display, Space_Grotesk } from "next/font/google";
import TasarimDemo from "@/components/tasarim/TasarimDemo";

/* Her yönün kendi tipografisi var — kimliğin en belirleyici parçası.
   latin-ext şart: ğ/ş/ı/İ/ö/ü/ç bu alt kümede. */
const gazete = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-gazete",
  style: ["normal", "italic"],
});
const cini = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-cini",
});
const pop = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-pop",
});

export const metadata: Metadata = {
  title: "Tasarım yönleri — Günsel",
  robots: { index: false, follow: false },
};

export default function TasarimPage() {
  return (
    <div className={`${gazete.variable} ${cini.variable} ${pop.variable}`}>
      <TasarimDemo />
    </div>
  );
}

import type { GameMeta } from "@/lib/types";

export const games: GameMeta[] = [
  {
    id: "kelimesel",
    name: "Kelimesel",
    href: "/kelimesel",
    description: "3-8 harf arasında seçtiğin uzunlukta günün kelimesini bul.",
    accent: "green",
  },
  {
    id: "sarkisal",
    name: "Şarkısal",
    href: "/sarkisal",
    description: "Tümü, Pop ve Rap kategorilerinde kısa bir kesitten şarkıyı tahmin et.",
    accent: "yellow",
  },
  {
    id: "harfBahcesi",
    name: "Harf Peteği",
    href: "/harf-bahcesi",
    description: "7 harften en az 4 harfli kelimeler türet.",
    accent: "green",
  },
  {
    id: "dahaAzCok",
    name: "Daha Az / Daha Çok",
    href: "/daha-az-cok",
    description: "İki değerden hangisi daha büyük, tahmin et.",
    accent: "red",
  },
  {
    id: "haritasal",
    name: "Haritasal",
    href: "/haritasal",
    description: "Ülkeyi ya da Türkiye ilini siluetinden bul; her tahminde yön ve sıcaklık ipucu gelir.",
    accent: "green",
  },
  {
    id: "baglamsal",
    name: "Bağlamsal",
    href: "/baglamsal",
    description: "On altı kelimeyi dörder kelimelik dört gizli gruba ayır.",
    accent: "yellow",
  },
  {
    id: "renksel",
    name: "Renksel",
    href: "/renksel",
    description: "Görseldeki eksik bölgenin rengini hatırla ve bul.",
    accent: "red",
  },
  {
    id: "karesel",
    name: "Karesel",
    href: "/karesel",
    description: "Tek bir kareden filmi ya da diziyi tahmin et.",
    accent: "yellow",
  },
];

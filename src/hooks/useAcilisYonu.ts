"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Arama sonuç listesinin nereye ve hangi yöne açılacağını hesaplar.
 *
 * NEDEN PORTAL + FIXED: liste kutunun içinde `absolute` iken, oyun sayfalarının
 * `h-dvh` + `overflow-y-auto` sarmalayıcısı onu kabın kenarında KIRPIYORDU —
 * 8 sonuçtan yalnızca biri görünüyor, gerisi için listenin içinde kaydırmak
 * gerekiyordu. Liste artık `body` altına taşınıp ekran koordinatıyla
 * konumlanıyor, böylece alttaki tanıtım metninin üstüne taşabiliyor.
 *
 * NEDEN SÜREKLİ YENİDEN ÖLÇÜLÜYOR: `fixed` bir öğe sayfa kaydırılınca ya da
 * klavye açılıp kapanınca kutuyu TAKİP ETMEZ. Konum bir kez ölçüldüğünde liste
 * kutudan kopuyordu (kullanıcı bildirdi: klavye kapanınca liste yukarıda asılı
 * kaldı, sayfa kaydırılınca da yerinde durdu). Bu yüzden liste açık olduğu
 * sürece scroll/resize ve iOS'un visualViewport olayları dinleniyor.
 */
export function useAcilisYonu(acik: boolean) {
  const kapsayiciRef = useRef<HTMLDivElement | null>(null);
  const [yukariAc, setYukariAc] = useState(false);
  /** Portal ile body altına taşınan listenin ekran koordinatı. */
  const [konum, setKonum] = useState<{
    sol: number;
    genislik: number;
    ust: number;
    alt: number;
  } | null>(null);
  /** Son istenen liste yüksekliği — yeniden ölçümde de gerekiyor. */
  const yukseklikRef = useRef(220);

  /**
   * Listeyi KIRPAN en yakın atayı bulur. Sınır pencere DEĞİL: kırpma o kapta
   * oluyor ve pencereye göre ölçmek "aşağıda bol yer var" sonucunu veriyordu.
   */
  const kirpanAta = (el: HTMLElement): HTMLElement | null => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      if (getComputedStyle(p).overflow !== "visible") return p;
      p = p.parentElement;
    }
    return null;
  };

  const hesapla = useCallback(() => {
    const el = kapsayiciRef.current;
    if (!el) return;
    const kutu = el.getBoundingClientRect();

    /* iOS'ta klavye açılınca `window.innerHeight` KÜÇÜLMÜYOR, yalnızca
       visualViewport küçülüyor. Onu kullanmazsak klavyenin arkasını boş yer
       sanıyoruz. */
    const gorunurAlt = window.visualViewport
      ? window.visualViewport.offsetTop + window.visualViewport.height
      : window.innerHeight;

    const ata = kirpanAta(el);
    const ataKutu = ata?.getBoundingClientRect();
    const sinirAlt = ataKutu ? Math.min(ataKutu.bottom, gorunurAlt) : gorunurAlt;
    const sinirUst = ataKutu ? Math.max(ataKutu.top, 0) : 0;

    const altBosluk = sinirAlt - kutu.bottom;
    const ustBosluk = kutu.top - sinirUst;

    setYukariAc(altBosluk < yukseklikRef.current && ustBosluk > altBosluk);
    setKonum({ sol: kutu.left, genislik: kutu.width, ust: kutu.top, alt: kutu.bottom });
  }, []);

  /** Liste açılırken/sonuçlar değişirken çağrılır. */
  const olc = useCallback(
    (listeYuksekligi: number) => {
      yukseklikRef.current = listeYuksekligi;
      /* rAF: ölçüm liste yerleştikten sonra yapılmalı; ayrıca bu proje effect
         gövdesinde senkron setState'i yasaklıyor. */
      requestAnimationFrame(hesapla);
    },
    [hesapla],
  );

  useEffect(() => {
    if (!acik) {
      const t = requestAnimationFrame(() => setKonum(null));
      return () => cancelAnimationFrame(t);
    }
    /* rAF içinde: bu proje effect gövdesinde SENKRON setState'i yasaklıyor
       (react-hooks/set-state-in-effect) — zaten ölçümün de yerleşim
       tamamlandıktan sonra yapılması gerekiyor. */
    const ilk = requestAnimationFrame(hesapla);
    const vv = window.visualViewport;
    /* scroll'da `true`: kaydırma iç kaplarda oluyor, pencerede değil —
       yakalama aşamasında dinlenmezse olay hiç gelmiyor. */
    window.addEventListener("scroll", hesapla, true);
    window.addEventListener("resize", hesapla);
    vv?.addEventListener("resize", hesapla);
    vv?.addEventListener("scroll", hesapla);
    return () => {
      cancelAnimationFrame(ilk);
      window.removeEventListener("scroll", hesapla, true);
      window.removeEventListener("resize", hesapla);
      vv?.removeEventListener("resize", hesapla);
      vv?.removeEventListener("scroll", hesapla);
    };
  }, [acik, hesapla]);

  return { kapsayiciRef, yukariAc, konum, olc };
}

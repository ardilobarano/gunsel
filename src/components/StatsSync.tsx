"use client";

import { useEffect } from "react";
import { collectLocalHistory, mergeServerResults, type SunucuSonucu } from "@/lib/storage";

/** Sekme içi SPA geçişlerinde tekrar tekrar istek atmasın diye bir eşik. Bu bileşen
 *  kök layout'ta olduğu için normal sayfa geçişlerinde zaten yeniden mount OLMUYOR
 *  (effect zaten sadece bir kez çalışıyor) — burası sadece art arda hızlı SAYFA
 *  YENİLEMELERİNİ (F5) sınırlıyor. ESKİDEN "sekmede bir kez, süresiz" bir bayraktı;
 *  bu, gerçek bir hatayı ortaya çıkardı: PC'de bir kez senkronlanan bir sekme, o
 *  sekme kapanana kadar BİR DAHA senkronlamıyordu — telefonda sonradan bitirilen
 *  bir oyun, PC sekmesi yenilense bile hiç görünmüyordu (kullanıcı bildirdi).
 *  Süreli eşik hem spam'i önlüyor hem "yenile, bak geldi mi" beklentisini bozmuyor. */
const OTURUM_ANAHTARI = "gunsel_sync_at";
const ESIK_MS = 30_000;
/**
 * Giriş yapmış oyuncunun geçmişini cihazla senkronlar.
 *
 * İki yön:
 * 1) YUKARI GÖNDERME: localStorage'daki bitmiş günler sunucuya gönderilir.
 *    İki işi var: (a) sunucu tarafı kayıt bugün başladığı için eski geçmişin
 *    taşınması — yoksa aylardır oynayan biri giriş yapınca sıfır görürdü;
 *    (b) HARF PETEĞİ. Onun sunucu tarafı yok (kelime doğrulaması tarayıcıda),
 *    dolayısıyla sonucu sunucuya başka türlü ulaşmıyor. Her oturumda gönderiliyor,
 *    "bir kez" değil — sunucu kendi yazdığı satırın üzerine yazmadığı için
 *    (skipDuplicates) tekrarlamak zararsız ve Harf Peteği'ni de kapsıyor.
 * 2) BİRLEŞTİRME: sunucudaki geçmiş cihaza yazılır. Telefonda oynanan gün
 *    bilgisayarda da görünür hale gelir.
 *
 * Girişsiz kullanıcıda hiçbir şey yapmaz; oyunlar eskisi gibi tamamen yerel çalışır.
 */
export default function StatsSync() {
  useEffect(() => {
    // Etkinin gövdesinde senkron setState yok (bkz. CLAUDE.md lint kuralı) — bu
    // bileşenin state'i de yok, sadece yan etki olarak depoyu güncelliyor.
    let iptal = false;

    try {
      const son = Number(window.sessionStorage.getItem(OTURUM_ANAHTARI) ?? "0");
      if (Date.now() - son < ESIK_MS) return;
    } catch {
      return; // depolama kapalıysa senkron da yok
    }

    async function senkronla() {
      const ilk = await fetch("/api/istatistikler").then((r) => (r.ok ? r.json() : null));
      if (iptal || !ilk?.signedIn) return;

      try {
        window.sessionStorage.setItem(OTURUM_ANAHTARI, String(Date.now()));
      } catch {
        /* yoksay */
      }

      // 1) Yukarı gönderme.
      let sonuclar: SunucuSonucu[] = ilk.results ?? [];
      const yerel = collectLocalHistory();
      if (yerel.length > 0) {
        const res = await fetch("/api/istatistikler", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results: yerel }),
        });
        const eklendi = res.ok ? ((await res.json())?.imported ?? 0) : 0;
        // Yeni satır eklendiyse sunucudaki liste değişti — güncelini al.
        if (eklendi > 0) {
          const tekrar = await fetch("/api/istatistikler").then((r) => (r.ok ? r.json() : null));
          if (tekrar?.results) sonuclar = tekrar.results;
        }
      }

      if (iptal) return;

      // 2) Birleştirme. Değişiklik olduysa aynı sekmedeki dinleyicileri (hub rozeti,
      //    istatistik görünümü) uyandır — "storage" olayı normalde sadece DİĞER
      //    sekmelere gider, bu yüzden elle tetikleniyor.
      if (mergeServerResults(sonuclar)) {
        window.dispatchEvent(new Event("storage"));
      }
    }

    void senkronla().catch(() => {
      /* ağ hatası senkronu atlar, oyun yerel veriyle çalışmaya devam eder */
    });

    return () => {
      iptal = true;
    };
  }, []);

  return null;
}

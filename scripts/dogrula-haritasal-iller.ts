/**
 * Türkiye İlleri sekmesinin günlük seçimini doğrular.
 *
 * Ölçtükleri:
 *  1) TEKRAR ARALIĞI — tur karışımı gerçekten çalışıyor mu. 81 günde 81 farklı
 *     il çıkmalı; çıkmıyorsa seçim `hash(tarih) % 81` gibi davranıyor demektir
 *     ve doğum günü paradoksundan ilk tekrar daha 10. günde gelir.
 *  2) DÜNYA SEKMESİ BOZULDU MU — iller eklenirken dünyanın tur tohumuna
 *     dokunulmadığından emin olmak için bilinen günlerin ülkesi yazdırılıyor.
 *  3) İKİ SEKMENİN BAĞIMSIZLIĞI — aynı gün iki sekmede aynı sıra numarası
 *     seçilmemeli, yoksa sekmeler birbirine kilitlenir.
 *
 * Çalıştırma: node --import tsx scripts/dogrula-haritasal-iller.ts
 */
import { createRequire } from "node:module";

/* `server-only` Next.js dışında import edilince ATIYOR, bu yüzden oyunların
   .server.ts dosyaları normalde script'ten çağrılamıyor (bkz. CLAUDE.md). Burada
   o paket boş bir modülle değiştiriliyor ki doğrulama GERÇEK seçim fonksiyonunu
   çalıştırsın. Mantığı script içinde yeniden yazmak doğrulamayı totolojiye
   çevirirdi: kendi kopyamı kendime doğrulatmış olurdum. */
const require_ = createRequire(import.meta.url);
const Module = require_("node:module") as { _load: (...a: unknown[]) => unknown };
const asilLoad = Module._load;
Module._load = function (this: unknown, istek: unknown, ...kalan: unknown[]) {
  if (istek === "server-only") return {};
  return asilLoad.call(this, istek, ...kalan);
};

/* Modül yüklenirken token gizini şart koşuyor. Bu script imzalama yapmıyor,
   yalnızca günün bölgesini seçiyor — gerçek gizi okumaya gerek yok, sahtesi
   modülün yüklenmesine yetiyor. */
process.env.GUESS_TOKEN_SECRET ??= "dogrulama-icin-sahte-giz";

function gunEkle(tarih: string, n: number): string {
  const [y, m, d] = tarih.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/* haritasal.server.ts icindeki ILLER_BASLANGIC ile AYNI olmali: tur bu gunden
   itibaren sayiliyor, baska bir gunden baslatilan olcum turu ortadan bolerdi. */
const BASLANGIC = "2026-08-14";

async function main() {
  const { getDailyBolge } = (await import("../src/lib/haritasal.server")) as {
    getDailyBolge: (tarih: string, kategori: string) => { label: string };
  };

  const iller: string[] = [];
  for (let i = 0; i < 200; i++) iller.push(getDailyBolge(gunEkle(BASLANGIC, i), "iller").label);

  const ilkTekrar = iller.findIndex((il, i) => iller.indexOf(il) !== i);
  const ilk81 = new Set(iller.slice(0, 81));
  console.log(`ilk 81 günde farklı il : ${ilk81.size}/81   (ilk tekrar ${ilkTekrar + 1}. günde)`);
  console.log(`iller ilk 7 gün       : ${iller.slice(0, 7).join(", ")}`);

  const dunya: string[] = [];
  for (let i = 0; i < 7; i++) dunya.push(getDailyBolge(gunEkle(BASLANGIC, i), "dunya").label);
  console.log(`dünya ilk 7 gün       : ${dunya.join(", ")}`);

  let ayni = 0;
  for (let i = 0; i < 200; i++) {
    const t = gunEkle(BASLANGIC, i);
    if (getDailyBolge(t, "iller").label === getDailyBolge(t, "dunya").label) ayni++;
  }
  console.log(`iki sekmede aynı ad    : ${ayni}/200 gün (Türkiye her iki havuzda da var)`);

  if (ilk81.size !== 81) {
    console.error("HATA: 81 günlük turda tekrar var — tur karışımı bozuk.");
    process.exit(1);
  }
  if (ilkTekrar !== 81) {
    console.error(`HATA: ilk tekrar ${ilkTekrar + 1}. günde, 82. günde olmalıydı.`);
    process.exit(1);
  }
  console.log("[tamam] bir il tekrar etmeden önce diğer 80'i çıkıyor.");
}

main();

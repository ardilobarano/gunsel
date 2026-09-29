/**
 * Renksel'in fotoğraf TARİFLERİ ve varlık üretimi.
 *
 * Her tarif bir soruya karşılık geliyor: kaynak fotoğraf, elle çizilen kaba
 * sınır, renk tohumları. `uret()` bunlardan `public/renksel/` altına
 * `<id>.jpg` (bölgesi gri baskılanmış fotoğraf) + `<id>.png` (alfa maskesi)
 * yazıyor ve ölçtüğü GERÇEK RENGİ döndürüyor — o değer elle
 * `src/data/renkselOgeler.ts`'e işleniyor (cevap, veri dosyasında yaşıyor).
 *
 * `--kontrol` ile ayrıca üç doğrulama görüntüsü üretiyor:
 *   `-1-sinir` maskenin sınırı fotoğrafın üstünde
 *   `-2-dogru` DOĞRU renkle boyanmış hâli (özgün fotoğrafa dönmeli)
 *   `-3-yanlis` karşıt renkle boyanmış hâli (maskenin kaçırdığı yer sırıtır)
 *
 * GÖZLE DOĞRULAMA TEK BAŞINA YETMİYOR — bu iş sırasında üç kez yanılttı:
 * ekranda "sarı taksi gövdesi" görünen yer ölçüldüğünde koyu kırmızı yansıma
 * çıktı, "maske ayın içine giriyor" sanılan yerler ölçüldüğünde gerçekten
 * kırmızıydı. Maskeyi onaylarken kontrol görüntüsünün YANINDA sayısal ölçüme
 * de bak: maske içi/dışı ortalama kroma birbirinden açıkça ayrılmalı.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { uret, type MaskeTarifi, type UretimSonucu } from "./renksel-hazirla";

/** Kaynak fotoğraflar (git'e girmiyor — Unsplash'ten indirilen özgün dosyalar). */
const FOTO = process.env.RENKSEL_FOTO_DIZINI ?? path.join("scratch", "renksel-foto");
/** Üretilen varlıklar doğrudan siteye yazılıyor. */
const CIKTI = process.env.RENKSEL_CIKTI_DIZINI ?? path.join("public", "renksel");
const KONTROL = process.argv.includes("--kontrol");
const OLCUM = process.env.RENKSEL_OLCUM ?? path.join("scratch", "renksel-olcum.json");
const KONTROL_DIZIN = process.env.RENKSEL_KONTROL_DIZINI ?? path.join("scratch", "renksel-kontrol");

const TARIFLER: MaskeTarifi[] = [
  /* TÜRK BAYRAĞI DENENDİ VE ŞİMDİLİK BIRAKILDI. Kanonik konu olarak ideal
     (resmî kırmızı #E30A17) ama dalgalanan bayrağın kıvrım gölgeleri çok
     derin: maske o bölgeleri tutmuyor ve karede koyu kırmızı lekeler kalıyor,
     yani cevap kısmen görünüyor. Düz asılı, düz ışık alan bir bayrak karesi
     bulunursa geri eklenmeli. */
  {
    // AÇIK + PARLAK BOYA, RENKLİ SAHNE İÇİNDE: fotoğrafın geri kalanı tam
    // renkli kalıyor, yalnızca gövde değişiyor. Camlar, tekerlekler, damalı
    // şerit ve "TGS 72" yazısı maskede DELİK kalmalı.
    //
    // İLK SEÇİLEN TAKSİ FOTOĞRAFI ELENDİ: araba parlak boyalıydı ve karşısındaki
    // kırmızı cepheyi yansıtıyordu — gövdenin yarısı sarı değil koyu kırmızı
    // pikseldi (ölçüldü), yani "sarı" diye maskelenecek şey orada yoktu.
    // Parlak yüzeylerde renkli yansıma bu tekniğin gerçek sınırı; fotoğraf
    // seçerken DÜZ/dağınık ışık aranmalı.
    id: "taksi",
    foto: path.join(FOTO, "taksi-b.jpg"),
    kirp: { left: 280, top: 1322, width: 871, height: 498 },
    genislik: 1000,
    sinir:
      "M150 385 L150 265 L200 220 L270 190 L360 165 L470 150 L560 165 " +
      "L650 205 L710 260 L710 330 L640 375 L400 392 Z",
    tohumlar: [
      [250, 290],
      [400, 250],
      [620, 250],
      [200, 260],
      [300, 330],
      [520, 300],
    ],
    parlaklikAgirligi: 0.35,
    esik: 20,
    rampa: 8,
    delikleriDoldur: false,
    // Tavan kenarında ince bir sarı çizgi kalıyordu; taşma artırıldı.
    tasma: 4,
  },
  /* Trafik konisi: "güvenlik turuncusu" standart bir renk, örnekten örneğe
     limon gibi kaymıyor — kanonik havuzda kalıyor. */
  { id: "koni",      foto: path.join(FOTO, "koni.jpg"),      genislik: 900, esik: 26, rampa: 14, parlaklikAgirligi: 0.25,
    sinir: "M430 55 H900 V515 H430 Z", tekParca: false,
    tohumlar: [[617, 210], [610, 238], [650, 294], [534, 309], [644, 342]] },

  /* MARKA/KARAKTER FOTOĞRAFLARI KALDIRILDI (politika, 2026-08-19).
     Denenen ve elenen yollar, tekrar denenmesin diye:
     - Lisanslı oyuncak/figür fotoğrafı (Funko Pikachu, SüngerBob oyuncağı):
       görünen renk karakterin değil PLASTİĞİN rengi, ayrıca karakterin
       görünümünü doğrudan taşıyor.
     - Wikimedia Commons'taki RESMÎ logo dosyaları: lisans temizdi ama politika
       resmî çizimin kopyalanmamasını söylüyor.
     Yerine kendi şematik vektör çizimlerimiz geçti: `renksel-cizimler.ts`,
     üretim `npm run renksel:cizim`. */
  /* --- GERÇEK NESNE FOTOĞRAFLARI ---
     Marka çizimi değil, dünyada çekilmiş kare. Rengi standartla tanımlı
     olanlar seçiliyor; `resmiRenk` hem tohumu hem kırpmayı yönlendiriyor,
     `resmiFark` de karenin ışığını denetliyor. */
  { id: "londra-otobusu", foto: path.join(FOTO, "londra-otobusu.jpg"), genislik: 900, esik: 24, rampa: 12, parlaklikAgirligi: 0.3, tekParca: false, tasma: 3,
    /* Londra toplu taşımasının kurumsal kırmızısı. */
    resmiRenk: "#dc241f", otomatikKirp: true },
  /* --- ÇİZGİ FİLM KARAKTERLERİ (gerçek görsel) ---
     Cevap ÖLÇÜMDEN geliyor: kaynak karakterin kendi çizimi olduğu için ölçülen
     renk zaten kanonik renktir. `tohumRenk` yalnızca maskenin nereyi arayacağını
     söylüyor, cevabı değiştirmiyor.

     otomatikKirp KAPALI: bu görseller indirilirken zaten ortalanıp paylı bir
     kareye yerleştiriliyor. Açık bırakıldığında kırpma renge odaklanıp Şirin'in
     kafasını, Nemo'nun gövdesini ve Mario'nun tişörtünü kadraj dışında
     bırakıyordu. */
  { id: "sunger-karakter",    foto: path.join(FOTO, "sunger-karakter.jpg"),    genislik: 900, esik: 26, rampa: 13, parlaklikAgirligi: 0.35, tekParca: false, tasma: 3,
    tohumRenk: "#f5e050" },
  { id: "sari-fare-karakter", foto: path.join(FOTO, "sari-fare-karakter.jpg"), genislik: 900, esik: 26, rampa: 13, parlaklikAgirligi: 0.35, tekParca: false, tasma: 3,
    /* Tohum ile cevap BİLEREK farklı: bu çizimin sarısı #fff080 (anime hücre
       stili), karakterin kanonik sarısı #ffcb05. Tohum görseldekini bulmalı,
       cevap oyuncunun hatırladığı renk olmalı. resmîFark bu yüzden yüksek —
       burada ışık değil ÜSLUP farkı var. */
    tohumRenk: "#fff080", resmiRenk: "#ffcb05" },
  { id: "kulahli-karakter",   foto: path.join(FOTO, "kulahli-karakter.jpg"),   genislik: 900, esik: 26, rampa: 13, parlaklikAgirligi: 0.35, tekParca: false, tasma: 3,
    tohumRenk: "#4fb3e8" },
  { id: "kirmizi-sapka",      foto: path.join(FOTO, "kirmizi-sapka.jpg"),      genislik: 900, esik: 24, rampa: 12, parlaklikAgirligi: 0.35, tekParca: false, tasma: 3,
    tohumRenk: "#e52521" },
  { id: "seritli-balik",      foto: path.join(FOTO, "seritli-balik.jpg"),      genislik: 900, esik: 26, rampa: 13, parlaklikAgirligi: 0.35, tekParca: false, tasma: 3,
    tohumRenk: "#f47b20" },
];

/** Tarayıcıdaki `mix-blend-mode: multiply` işleminin birebir taklidi. */
async function boya(tabanYolu: string, maskeYolu: string, hex: string): Promise<Buffer> {
  const { data, info } = await sharp(tabanYolu).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const alfa = await sharp(maskeYolu).extractChannel("alpha").raw().toBuffer();
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const out = Buffer.from(data);
  for (let i = 0; i < info.width * info.height; i++) {
    const a = alfa[i] / 255;
    if (a === 0) continue;
    for (let k = 0; k < 3; k++) {
      const carpim = data[i * 3 + k] * c[k];
      out[i * 3 + k] = Math.round(data[i * 3 + k] * (1 - a) + carpim * a);
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}

/** Maskenin sınırını fotoğrafın üstüne macenta çizer — nereyi tuttuğunu görmek için. */
async function sinirCiz(kaynak: sharp.Sharp, maskeYolu: string): Promise<Buffer> {
  const { data, info } = await kaynak.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const alfa = await sharp(maskeYolu).extractChannel("alpha").raw().toBuffer();
  const out = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const ic = alfa[i] > 128;
      const kenar =
        ic !== alfa[i - 1] > 128 || ic !== alfa[i + 1] > 128 ||
        ic !== alfa[i - w] > 128 || ic !== alfa[i + w] > 128;
      if (!kenar) continue;
      out[i * 3] = 255;
      out[i * 3 + 1] = 0;
      out[i * 3 + 2] = 255;
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

async function main() {
  await mkdir(CIKTI, { recursive: true });
  const olcumler: Record<string, UretimSonucu> = {};
  if (KONTROL) await mkdir(KONTROL_DIZIN, { recursive: true });
  for (const tarif of TARIFLER) {
    const sonuc = await uret(tarif, CIKTI);
    olcumler[sonuc.id] = sonuc;
    /* AYRIŞMA UYARISI: maske içi/dışı ortalama kroma birbirine yakınsa maske
       yanlış bölgeyi tutuyordur. Bu satır kontrol görüntüsünden ÖNCE okunmalı. */
    const ayrisma = sonuc.icKroma - sonuc.disKroma;
    /* Sıralama bilinçli: dışarıda kalan cevap rengi en ağır kusur, önce o. */
    const bayrak =
      sonuc.disSizinti > 600
        ? `  << CEVAP MASKE DIŞINDA GÖRÜNÜYOR (${sonuc.disSizinti} piksel)`
        : ayrisma < 12
          ? "  << AYRIŞMA ZAYIF, MASKEYİ GÖZDEN GEÇİR"
          : sonuc.notrOran > 25
            ? "  << MASKE NÖTR ZEMİN YUTUYOR"
            : "";
    console.log(
      `${sonuc.id.padEnd(12)} ${String(sonuc.genislik).padStart(4)}x${String(sonuc.yukseklik).padEnd(4)}` +
        ` renk=${sonuc.renk}  bölge=%${String(sonuc.oran).padStart(5)}` +
        `  kroma içi/dışı=${String(sonuc.icKroma).padStart(5)}/${String(sonuc.disKroma).padStart(4)}` +
        `  sızıntı=${sonuc.sizintiKroma}  nötr=%${sonuc.notrOran}` +
        (sonuc.resmiFark ? `  resmîFark=${sonuc.resmiFark}` : "") +
        (sonuc.resmiFark > 25 ? "  << FOTOĞRAFIN IŞIĞI BOZUK, KAREYİ DEĞİŞTİR" : "") +
        bayrak
    );

    let kaynak = sharp(tarif.foto);
    if (tarif.kirp) kaynak = kaynak.extract(tarif.kirp);
    if (tarif.genislik) kaynak = kaynak.resize(tarif.genislik);

    const taban = path.join(CIKTI, `${sonuc.id}.jpg`);
    const maske = path.join(CIKTI, `${sonuc.id}.png`);
    // Yanlış renk bilerek doğrunun tam karşısı: tekniğin renk değiştirdiği
    // apaçık görünsün diye.
    const yanlis = "#" + [1, 3, 5].map((i) => (255 - parseInt(sonuc.renk.slice(i, i + 2), 16))
      .toString(16).padStart(2, "0")).join("");

    if (!KONTROL) continue;

    /* Tek bir tabakaya birleştirme DENENDİ ve BIRAKILDI: sharp `resize`'ı
       `composite`'ten ÖNCE uyguluyor, paneller birbirinin üstüne taşıyor.
       Ayrı dosyalar hem doğru hem tam çözünürlükte — asıl soru "fotoğraf gibi
       duruyor mu", o da ancak tam boyda görülüyor. */
    await sharp(await sinirCiz(kaynak, maske)).jpeg({ quality: 90 })
      .toFile(path.join(KONTROL_DIZIN, `kontrol-${sonuc.id}-1-sinir.jpg`));
    await sharp(await boya(taban, maske, sonuc.renk)).jpeg({ quality: 90 })
      .toFile(path.join(KONTROL_DIZIN, `kontrol-${sonuc.id}-2-dogru.jpg`));
    await sharp(await boya(taban, maske, yanlis)).jpeg({ quality: 90 })
      .toFile(path.join(KONTROL_DIZIN, `kontrol-${sonuc.id}-3-yanlis.jpg`));
  }
  /* Ölçümler dosyaya da yazılıyor: `renkselOgeler.ts`'teki CEVAP renkleri
     elle kopyalanmamalı, üretimin ölçtüğü değer olmalı. */
  await mkdir(path.dirname(OLCUM), { recursive: true });
  await writeFile(OLCUM, JSON.stringify(olcumler, null, 2), "utf8");
  console.log(`
Ölçümler: ${OLCUM}`);
  console.log(`Varlıklar: ${CIKTI}${KONTROL ? `  |  kontrol: ${KONTROL_DIZIN}` : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

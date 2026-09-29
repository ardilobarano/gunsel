/**
 * Kendi şematik çizimlerimizden Renksel varlıklarını üretir.
 *
 * MASKE TAHMİN EDİLMİYOR, HESAPLANIYOR. Fotoğraflarda bölgeyi renk
 * benzerliğiyle bulmak gerekiyordu (ve bu iş boyunca en çok hatayı orası
 * verdi). Vektörde buna gerek yok: çizim `{{hedef}}` yer tutucusuyla İKİ KEZ
 * basılıyor — bir kez siyah, bir kez beyaz — ve iki kare arasındaki fark tam
 * olarak sorulan bölgedir. Kenar yumuşaması da doğal olarak doğru çıkıyor,
 * çünkü fark yarı saydam pikselde de orantılı.
 *
 * TABAN GÖRSEL: çizim `{{hedef}}` yerine BEYAZ ile basılıyor. Düz renkli bir
 * bölgede gölge haritası zaten sabit; beyaz zemine `multiply` uygulanınca
 * sonuç birebir seçilen renk oluyor. Fotoğraflardaki `L(piksel)/L(renk)`
 * hesabına burada ihtiyaç yok.
 *
 * Cevap rengi sunulan dosyada YOK: taban görselde bölge beyaz.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CIZIMLER, type RenkselCizim } from "./renksel-cizimler";

const CIKTI = process.env.RENKSEL_CIKTI_DIZINI ?? path.join("public", "renksel");
const OLCUM = process.env.RENKSEL_CIZIM_OLCUM ?? path.join("scratch", "renksel-cizim-olcum.json");

function svgYap(c: RenkselCizim, hedefRengi: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${c.genislik}" height="${c.yukseklik}" ` +
      `viewBox="0 0 ${c.genislik} ${c.yukseklik}">${c.svg.split("{{hedef}}").join(hedefRengi)}</svg>`
  );
}

async function uretCizim(c: RenkselCizim) {
  const siyah = await sharp(svgYap(c, "#000000")).removeAlpha().raw().toBuffer();
  const beyaz = await sharp(svgYap(c, "#ffffff")).removeAlpha().raw().toBuffer();
  const piksel = c.genislik * c.yukseklik;

  /* Fark = bölgenin kendisi. Üç kanalın en büyüğü alınıyor: hedef renk
     kanallardan birinde değişmeyebilir, hepsinde birden değişmemesi imkânsız. */
  const alfa = Buffer.alloc(piksel * 4);
  let secili = 0;
  for (let i = 0; i < piksel; i++) {
    let fark = 0;
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(beyaz[i * 3 + k] - siyah[i * 3 + k]);
      if (d > fark) fark = d;
    }
    alfa[i * 4 + 3] = fark;
    if (fark > 128) secili++;
  }
  if (secili < 500) throw new Error(`${c.id}: bölge boş — çizimde {{hedef}} kullanılmış mı?`);

  /* BÖLGENİN DIŞ HATTI ÇİZİLİYOR. Taban görselde bölge beyaz olduğu için,
     içindeki beyaz ayrıntılarla (bayrakta ay-yıldız, levhada yazı) birlikte
     kaybolup bomboş bir leke haline geliyordu — oyuncu neye baktığını
     göremiyordu. Fotoğraflarda bu sorun yok, orada gölge şekli okutuyor.
     Kontur maskenin BİR TIK DIŞINA çiziliyor: böylece `multiply` ona
     dokunmuyor ve seçilen rengin doğruluğunu bozmuyor. */
  const taban = await sharp(svgYap(c, "#ffffff")).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer();
  const ic = new Uint8Array(piksel);
  for (let i = 0; i < piksel; i++) ic[i] = alfa[i * 4 + 3] > 40 ? 1 : 0;
  const genis = new Uint8Array(ic);
  for (let t = 0; t < 3; t++) {
    const y2 = new Uint8Array(genis);
    for (let y = 1; y < c.yukseklik - 1; y++) {
      for (let x = 1; x < c.genislik - 1; x++) {
        const i = y * c.genislik + x;
        if (genis[i]) continue;
        if (genis[i - 1] || genis[i + 1] || genis[i - c.genislik] || genis[i + c.genislik]) y2[i] = 1;
      }
    }
    genis.set(y2);
  }
  for (let i = 0; i < piksel; i++) {
    if (!genis[i] || ic[i] || alfa[i * 4 + 3] > 10) continue;
    taban[i * 3] = 0xc4;
    taban[i * 3 + 1] = 0xc0;
    taban[i * 3 + 2] = 0xb6;
  }

  await mkdir(CIKTI, { recursive: true });
  await sharp(taban, { raw: { width: c.genislik, height: c.yukseklik, channels: 3 } })
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .toFile(path.join(CIKTI, `${c.id}.jpg`));
  await sharp(alfa, { raw: { width: c.genislik, height: c.yukseklik, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(CIKTI, `${c.id}.png`));

  return { id: c.id, genislik: c.genislik, yukseklik: c.yukseklik, renk: c.renk, oran: (secili / piksel) * 100 };
}

async function main() {
  const olcumler: Record<string, unknown> = {};
  for (const c of CIZIMLER) {
    const s = await uretCizim(c);
    olcumler[s.id] = s;
    console.log(`${s.id.padEnd(14)} ${s.genislik}x${s.yukseklik}  renk=${s.renk}  bölge=%${s.oran.toFixed(1)}`);
  }
  await mkdir(path.dirname(OLCUM), { recursive: true });
  await writeFile(OLCUM, JSON.stringify(olcumler, null, 2), "utf8");
  console.log(`\nVarlıklar: ${CIKTI}\nÖlçümler: ${OLCUM}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

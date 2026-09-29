/**
 * Fotoğrafın üstüne KOORDİNAT IZGARASI basar.
 *
 * Maskenin kaba sınırını ve renk tohumlarını gözle tahmin etmek işe yaramıyor:
 * ilk denemede üç örneğin üçünde de noktalar yanlış yere düştü (taksinin
 * gövdesi sanılan nokta tekerlek gölgesine denk geldi). Izgara basılı bir
 * kopyaya bakıp koordinat okumak bu adımı tek seferde doğru yapıyor.
 *
 * Kullanım:
 *   node --import tsx scripts/renksel-izgara.ts <foto> <cikti.png> [genislik] [kirp:l,t,w,h]
 */
import sharp from "sharp";

async function main() {
  const [foto, cikti, genislikArg, kirpArg] = process.argv.slice(2);
  if (!foto || !cikti) {
    console.error("Kullanım: renksel-izgara.ts <foto> <cikti.png> [genislik] [l,t,w,h]");
    process.exit(1);
  }

  let boru = sharp(foto);
  if (kirpArg) {
    const [left, top, width, height] = kirpArg.split(",").map(Number);
    boru = boru.extract({ left, top, width, height });
  }
  if (genislikArg) boru = boru.resize(Number(genislikArg));

  const png = await boru.png().toBuffer();
  const { width: w, height: h } = await sharp(png).metadata();

  const adim = 100;
  const parcalar: string[] = [];
  for (let x = 0; x <= w; x += adim) {
    parcalar.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#ff00ff" stroke-width="1" opacity="0.55"/>`);
    parcalar.push(
      `<text x="${x + 3}" y="14" font-family="monospace" font-size="13" fill="#ff00ff" stroke="#000" stroke-width="3" paint-order="stroke">${x}</text>`
    );
  }
  for (let y = 0; y <= h; y += adim) {
    parcalar.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#ff00ff" stroke-width="1" opacity="0.55"/>`);
    parcalar.push(
      `<text x="3" y="${y - 4}" font-family="monospace" font-size="13" fill="#00ffff" stroke="#000" stroke-width="3" paint-order="stroke">${y}</text>`
    );
  }

  const kaplama = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${parcalar.join("")}</svg>`;
  await sharp(png).composite([{ input: Buffer.from(kaplama) }]).png().toFile(cikti);
  console.log(`${cikti} — ${w}x${h}, ızgara ${adim}px`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

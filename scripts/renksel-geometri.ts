/**
 * Şematik çizimler için geometri yardımcıları.
 *
 * NEDEN VAR: ilk çizimlerde yıldızın ve sekizgenin köşe koordinatlarını ELLE
 * yazmıştım; yıldız düzgün beşgen yıldız olmadı, kolları eşit çıkmadı ve
 * üstüne gereksiz bir döndürme eklendi — kullanıcı haklı olarak "çizgiler
 * neden böyle" dedi. Renksel'in ilk SVG karakterlerinin beğenilmeme sebebi de
 * aynıydı: elle yazılmış yol verisi.
 *
 * Kural: çokgen/yıldız/yay koordinatı ELLE YAZILMAZ, hesaplanır.
 */

const rad = (derece: number) => (derece * Math.PI) / 180;
const yuvarla = (v: number) => Math.round(v * 100) / 100;

/** Merkezi (cx,cy) olan, `kenar` köşeli düzgün çokgen. `baslangic` derece. */
export function duzgunCokgen(
  cx: number,
  cy: number,
  r: number,
  kenar: number,
  baslangic = -90
): string {
  const noktalar: string[] = [];
  for (let i = 0; i < kenar; i++) {
    const a = rad(baslangic + (360 / kenar) * i);
    noktalar.push(`${yuvarla(cx + r * Math.cos(a))},${yuvarla(cy + r * Math.sin(a))}`);
  }
  return noktalar.join(" ");
}

/**
 * Düzgün beş köşeli yıldız (pentagram silueti).
 *
 * İç yarıçap uydurulmuyor: düzgün pentagramda iç/dış oran
 * sin(18°)/sin(126°) = 0,38197. Elle "gözüne göre" bir iç yarıçap vermek
 * kolları şişkin ya da cılız gösteriyor — ilk denemedeki hata buydu.
 */
export function besliYildiz(cx: number, cy: number, R: number, baslangic = -90): string {
  const r = R * (Math.sin(rad(18)) / Math.sin(rad(126)));
  const noktalar: string[] = [];
  for (let i = 0; i < 10; i++) {
    const yaricap = i % 2 === 0 ? R : r;
    const a = rad(baslangic + 36 * i);
    noktalar.push(`${yuvarla(cx + yaricap * Math.cos(a))},${yuvarla(cy + yaricap * Math.sin(a))}`);
  }
  return noktalar.join(" ");
}

/**
 * Türk bayrağının ay-yıldızının KANUNDAKİ ölçüleri.
 *
 * Türk Bayrağı Kanunu bayrağı en (G) üzerinden tarif ediyor; buradaki
 * değerler o tarifin doğrudan uygulanması, göz kararı değil:
 *   - boy = 1,5 G
 *   - dış çember: merkez direk kenarından 0,5 G içeride, çap 0,5 G
 *   - iç çember: dış çemberden G/16 sağa kaymış, çap 0,4 G
 *   - yıldız: çevrel çember çapı 0,25 G, iç çemberin sağ ucundan G/16 uzakta
 */
export function turkBayragiOlculeri(G: number) {
  const disR = 0.25 * G;
  const icR = 0.2 * G;
  const disCx = 0.5 * G;
  const icCx = disCx + G / 16;
  const yildizR = 0.125 * G;
  const yildizCx = icCx + icR + G / 16 + yildizR;
  return {
    boy: 1.5 * G,
    en: G,
    merkezY: 0.5 * G,
    disCx,
    disR,
    icCx,
    icR,
    yildizCx,
    yildizR,
  };
}

/**
 * Tenis topunun iki dikiş yayı (önden görünüş).
 *
 * Dikiş, topun ortasından geçen bir "mercek" DEĞİL — ilk denemede öyle çıktı
 * ve yanlış görünüyordu. Önden bakıldığında dikiş, sol ve sağ kenara yakın
 * duran, merkeze doğru şişen iki yaydır. Uçlar çember üzerinde hesaplanıyor,
 * yani yay her zaman topun kenarında bitiyor.
 *
 * @param aci Uçların yatay eksenden sapması (derece). Büyüdükçe yay dikleşir.
 */
export function tenisDikisi(R: number, aci = 58): [string, string] {
  const t = rad(aci);
  const x = R * Math.cos(rad(180) - t);
  const y = R * Math.sin(rad(180) - t);
  const rx = R * 0.5;
  const ry = R * 0.92;
  /* Süpürme yönü: yaylar MERKEZE doğru şişmeli. Ters yönde çizildiğinde
     topun dışına taşıyor ve sarı alanın dışında beyaz çizgiler kalıyor. */
  const sol = `M ${yuvarla(x)} ${yuvarla(-y)} A ${yuvarla(rx)} ${yuvarla(ry)} 0 0 1 ${yuvarla(x)} ${yuvarla(y)}`;
  const sag = `M ${yuvarla(-x)} ${yuvarla(-y)} A ${yuvarla(rx)} ${yuvarla(ry)} 0 0 0 ${yuvarla(-x)} ${yuvarla(y)}`;
  return [sol, sag];
}

/** Eşit genişlikte dikey bantlı bayrak (Fransa, İtalya gibi). */
export function dikeyBantlar(boy: number, en: number, renkler: string[]): string {
  const w = boy / renkler.length;
  return renkler
    .map((r, i) => `<rect x="${yuvarla(i * w)}" y="0" width="${yuvarla(w + 0.5)}" height="${en}" fill="${r}"/>`)
    .join("");
}

/** Eşit yükseklikte yatay bantlı bayrak (Almanya, İrlanda değil ama Hollanda gibi). */
export function yatayBantlar(boy: number, en: number, renkler: string[]): string {
  const h = en / renkler.length;
  return renkler
    .map((r, i) => `<rect x="0" y="${yuvarla(i * h)}" width="${boy}" height="${yuvarla(h + 0.5)}" fill="${r}"/>`)
    .join("");
}

/**
 * İsviçre bayrağındaki haç.
 *
 * Ölçüler yönetmelikten: 32 birimlik kare bayrakta kolların genişliği 6,
 * uzunluğu 7 birim — yani haçın toplam açıklığı 6+7+7 = 20 birim. İlk denemede
 * kalınlığı uzunluğa yakın verdim ve haç KARE gibi çıktı.
 */
export function isvicreHaci(cx: number, cy: number, kenar: number): string {
  const acikllik = (kenar * 20) / 32;
  const kalinlik = (kenar * 6) / 32;
  return hac(cx, cy, acikllik, kalinlik);
}

/** Merkezi (cx,cy) olan, kol kalınlığı `kalinlik` olan artı/haç. */
export function hac(cx: number, cy: number, uzunluk: number, kalinlik: number): string {
  const u = uzunluk / 2;
  const k = kalinlik / 2;
  return (
    `<rect x="${yuvarla(cx - k)}" y="${yuvarla(cy - u)}" width="${kalinlik}" height="${uzunluk}" fill="#fff"/>` +
    `<rect x="${yuvarla(cx - u)}" y="${yuvarla(cy - k)}" width="${uzunluk}" height="${kalinlik}" fill="#fff"/>`
  );
}

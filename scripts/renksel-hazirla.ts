/**
 * Renksel'in fotoğraf varlıklarını üretir.
 *
 * NEDEN GEREKLİ — cevap rengi sızmasın diye. Fotoğrafı olduğu gibi gönderip
 * bölgeyi tarayıcıda gri tonlamaya çevirmek İŞE YARAMAZ: altındaki JPEG'te
 * gerçek renk hâlâ duruyor, geliştirici araçlarından görseli açan cevabı görür.
 * Bu yüzden bölgesi ÖNCEDEN gri baskılanmış ayrı bir kopya üretiliyor; sunulan
 * dosyada o bölgenin renk bilgisi hiç yok.
 *
 * ÜRETİLEN İKİ VARLIK (soru başına):
 *   `<id>.jpg`  — fotoğraf, ama maskelenen bölge GÖLGE HARİTASINA çevrilmiş
 *                 (gri). Bölge dışı tam renkli kalıyor.
 *   `<id>.png`  — maskenin alfa kanalı; istemci seçilen rengi yalnızca buranın
 *                 içine `multiply` ile bindiriyor.
 *
 * GÖLGE HARİTASI NEDEN DÜZ GRİ TONLAMA DEĞİL: `multiply` sonucu
 * `seçilen × gölge`. Gölgeyi `L(piksel) / L(gerçekRenk)` olarak ölçersek
 * oyuncu DOĞRU rengi seçtiğinde sonuç birebir özgün fotoğrafın parlaklığını
 * veriyor. Düz gri tonlama (L(piksel)) kullanılsaydı doğru renk bile
 * fotoğraftan çok daha koyu çıkardı — koyu bölgelerde (kot) her tahmin
 * siyaha yakın görünürdü.
 *
 * MASKE YARI OTOMATİK: elle çizilen KABA bir sınır (birkaç noktalı poligon) +
 * o sınırın içinde renk benzerliğine göre piksel seçimi. Elle tam sınır çizmek
 * gerekmiyor; taksinin damalı şeridi ve "TAV 15" yazısı gibi delikler renk
 * seçiminden kendiliğinden dışarıda kalıyor (elle çizilse onlarca ayrı yol
 * gerekirdi).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export interface MaskeTarifi {
  id: string;
  /** Kaynak fotoğraf yolu. */
  foto: string;
  /** İsteğe bağlı kırpma — sınır/tohum koordinatları KIRPILMIŞ görsele göre. */
  kirp?: { left: number; top: number; width: number; height: number };
  /** Çıktı genişliği (px). Yükseklik en boy oranından. */
  genislik?: number;
  /**
   * Elle çizilen KABA sınır: SVG yol verisi, çıktı piksel koordinatlarında.
   * Boş bırakılırsa TÜM KARE kullanılıyor — "düz zemin üstünde tek nesne"
   * tipi stüdyo fotoğraflarında sınır çizmeye gerek kalmıyor, renk seçimi
   * tek başına yetiyor.
   */
  sinir?: string;
  /**
   * Renk örneği alınacak noktalar (çıktı piksel koordinatları).
   *
   * Boş bırakılırsa OTOMATİK bulunuyor: sınırın içindeki renkli piksellerin
   * Lab histogramında en yoğun küme aranıyor. "Düz zemin üstünde tek renkli
   * nesne" tipi fotoğraflarda elle koordinat okumaya gerek kalmıyor; yalnızca
   * bölge birden çok renk içeriyorsa (taksinin gövdesi + damalı şerit) elle
   * vermek gerekiyor.
   */
  tohumlar?: [number, number][];
  /** Tohuma CIELAB uzaklığı bu değerin altındaki pikseller bölgeye TAM girer. */
  esik: number;
  /**
   * Eşiğin ötesinde alfanın 1'den 0'a indiği bant (CIELAB birimi, varsayılan 10).
   * Sert eşik denendi ve BIRAKILDI: bayrağın ay-yıldız kenarında kırmızıyla
   * beyaz arasındaki ara pikseller ya içeride ya dışarıda kalıyor, sınır
   * tırtıklı çıkıyordu.
   */
  rampa?: number;
  /**
   * Uzaklık ölçülürken PARLAKLIK farkının ağırlığı (varsayılan 1 = klasik ΔE).
   * Küçültmek "aynı renk, farklı ışık" bölgelerinde şart: bayrakta 1 iken maske
   * ayın ve yıldızın İÇİNE giriyordu — gölgede kalan beyaz ay, koyu kırmızı
   * kıvrımlarla aynı ΔE bandına düşüyor. 0,15'e indirilince ayırt eden şey
   * parlaklık değil ton/doygunluk oluyor ve ay tamamen dışarıda kalıyor.
   */
  parlaklikAgirligi?: number;
  /**
   * KANONİK renk: markanın/karakterin resmî değeri (örn. Coca-Cola #F40009).
   *
   * Verilirse cevap BU olur, fotoğraftan ölçülen değer değil. Şart, çünkü
   * ölçülen değer o karenin ışığına bağlı: Türk bayrağı fotoğrafından #941117
   * ölçülüyordu, oysa resmî kırmızı #E30A17. Yani bayrağın rengini DOĞRU
   * hatırlayan oyuncu bile düşük puan alıyordu — oyunun anlamını bozan bir
   * hata. Gölge haritası da bu değere bölünüyor, böylece oyuncu resmî rengi
   * seçtiğinde sonuç yine özgün fotoğrafın parlaklığını veriyor.
   */
  resmiRenk?: string;
  /**
   * Yalnızca TOHUM ipucu — cevabı DEĞİŞTİRMEZ.
   *
   * Logolarda cevap zaten doğru: kaynak markanın resmî çizimi olduğu için
   * ölçülen renk resmî renktir. Ama karede birden çok renk varsa otomatik
   * tohum şaşırabiliyor (Spotify'da siyah kareyi, THY'de kırmızı ile maviyi
   * karıştırıp moru seçti). Bu alan "şu rengi ara" demeye yarıyor, cevabı
   * dayatmaya değil.
   */
  tohumRenk?: string;
  /**
   * Kareyi, resmî renge yakın piksellerin çevresine OTOMATİK kırp.
   *
   * `resmiRenk` ile birlikte çalışıyor ve marka/karakter konularında elle
   * koordinat okumayı tamamen gereksiz kılıyor: aranan renk zaten bilindiği
   * için nesnenin karedeki yeri de hesaplanabiliyor. Bu grupta nesne çoğu
   * fotoğrafta karenin küçük bir parçası (Coca-Cola kutusu %2,8, Heineken
   * şişesi %1,6) — kırpılmadan hem maske zayıf kalıyor hem de oyuncu neye
   * bakacağını göremiyor.
   */
  otomatikKirp?: boolean;
  /** Bölgenin içindeki küçük boşlukları kapat (kot gibi tek parça bölgelerde). */
  delikleriDoldur?: boolean;
  /**
   * Maskenin bölgenin dışına taşırılacağı piksel sayısı (varsayılan 2).
   *
   * NEDEN BİLEREK TAŞIRILIYOR: iki hata simetrik değil. Maske DAR kalırsa
   * bölgenin kenarında gerçek renk görünür ve CEVAP SIZAR — domateste tam
   * olarak bu oldu, üst kenarda kırmızı bir hilal kaldı. Maske GENİŞ kalırsa
   * yalnızca birkaç piksellik zemin boyanır; göze zar zor çarpar ve hiçbir şey
   * ele vermez. Bu yüzden varsayılan hafif taşma.
   */
  tasma?: number;
  /**
   * Yalnızca EN BÜYÜK bağlı parçayı tut (varsayılan true).
   *
   * `false` yapmak, aynı nesnenin karede birden çok parçası varken ŞART:
   * avokado fotoğrafında iki yarım vardı, tek parça kuralı sağdakini maskeleyip
   * soldakini GERÇEK YEŞİL bırakıyordu — yani cevap fotoğrafın içinde
   * duruyordu. Kapatılınca belirli bir boyutun üstündeki tüm parçalar giriyor.
   */
  tekParca?: boolean;
}

/* --- renk yardımcıları --- */

function srgbLum(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const f0 = (v: number) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const [R, G, B] = [f0(r), f0(g), f0(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");

/* --- ikili maske işlemleri (morfoloji) --- */

/** 3x3 aşındırma/genişletme. `hedef` 1 ise genişletme, 0 ise aşındırma. */
function morfoloji(m: Uint8Array, w: number, h: number, hedef: 0 | 1, tekrar: number): Uint8Array {
  let kaynak = m;
  for (let t = 0; t < tekrar; t++) {
    const cikti = new Uint8Array(kaynak);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (kaynak[i] === hedef) continue;
        let komsu = false;
        for (let dy = -1; dy <= 1 && !komsu; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (kaynak[i + dy * w + dx] === hedef) {
              komsu = true;
              break;
            }
          }
        }
        if (komsu) cikti[i] = hedef;
      }
    }
    kaynak = cikti;
  }
  return kaynak;
}

/** En büyük bağlı bileşen dışındaki her şeyi siler (kopuk renk lekelerini atar). */
function enBuyukBilesen(m: Uint8Array, w: number, h: number): Uint8Array {
  const etiket = new Int32Array(w * h).fill(-1);
  const yigin = new Int32Array(w * h);
  let enIyiEtiket = -1;
  let enIyiBoyut = 0;
  let sonraki = 0;
  const komsular: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let s = 0; s < w * h; s++) {
    if (m[s] !== 1 || etiket[s] !== -1) continue;
    const bu = sonraki++;
    let tepe = 0;
    let boyut = 0;
    yigin[tepe++] = s;
    etiket[s] = bu;
    while (tepe > 0) {
      const i = yigin[--tepe];
      boyut++;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of komsular) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (m[j] === 1 && etiket[j] === -1) {
          etiket[j] = bu;
          yigin[tepe++] = j;
        }
      }
    }
    if (boyut > enIyiBoyut) {
      enIyiBoyut = boyut;
      enIyiEtiket = bu;
    }
  }
  const cikti = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (etiket[i] === enIyiEtiket) cikti[i] = 1;
  return cikti;
}

/** En büyük parçanın `oran` katından küçük olan parçaları siler; gerisini tutar.
 *  Eşik bilerek DÜŞÜK (0,04): atılan her parça, karede cevabı gösteren bir
 *  leke bırakıyor. Gürültüyü zaten morfoloji temizliyor. */
function buyukBilesenler(m: Uint8Array, w: number, h: number, oran: number): Uint8Array {
  const etiket = new Int32Array(w * h).fill(-1);
  const yigin = new Int32Array(w * h);
  const boyutlar: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (m[s] !== 1 || etiket[s] !== -1) continue;
    const bu = boyutlar.length;
    let tepe = 0;
    let boyut = 0;
    yigin[tepe++] = s;
    etiket[s] = bu;
    while (tepe > 0) {
      const i = yigin[--tepe];
      boyut++;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (m[j] === 1 && etiket[j] === -1) {
          etiket[j] = bu;
          yigin[tepe++] = j;
        }
      }
    }
    boyutlar.push(boyut);
  }
  const esik = Math.max(...boyutlar, 0) * oran;
  const cikti = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (etiket[i] >= 0 && boyutlar[etiket[i]] >= esik) cikti[i] = 1;
  return cikti;
}

/** Bölgenin içinde kalan, kenardan erişilemeyen boşlukları doldurur. */
function bosluklariDoldur(m: Uint8Array, w: number, h: number): Uint8Array {
  const disari = new Uint8Array(w * h);
  const yigin: number[] = [];
  for (let x = 0; x < w; x++) yigin.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) yigin.push(y * w, y * w + w - 1);
  while (yigin.length) {
    const i = yigin.pop()!;
    if (m[i] === 1 || disari[i] === 1) continue;
    disari[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) yigin.push(i - 1);
    if (x < w - 1) yigin.push(i + 1);
    if (y > 0) yigin.push(i - w);
    if (y < h - 1) yigin.push(i + w);
  }
  const cikti = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cikti[i] = m[i] === 1 || disari[i] === 0 ? 1 : 0;
  return cikti;
}

/**
 * Fotoğrafı, verilen renge yakın piksellerin sınırlayıcı kutusunun çevresine
 * kırpar. Kutu, nesne kadrajda nefes alsın diye payla genişletiliyor.
 */
async function renkCevresineKirp(
  foto: string,
  hedefHex: string
): Promise<{ left: number; top: number; width: number; height: number } | undefined> {
  const OLCEK = 400;
  const kucuk = sharp(foto).resize(OLCEK, OLCEK, { fit: "inside" });
  const { data, info } = await kucuk.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const hedef = rgbToLab(...([1, 3, 5].map((i) => parseInt(hedefHex.slice(i, i + 2), 16)) as [number, number, number]));

  const isaret = new Uint8Array(info.width * info.height);
  for (let i = 0; i < info.width * info.height; i++) {
    const l = rgbToLab(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    // Parlaklık düşük ağırlıkla: nesnenin gölgeli yüzü de kadraja girmeli.
    if (Math.hypot(0.35 * (l[0] - hedef[0]), l[1] - hedef[1], l[2] - hedef[2]) < 28) isaret[i] = 1;
  }
  const enBuyuk = enBuyukBilesen(isaret, info.width, info.height);

  let x0 = info.width;
  let y0 = info.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (!enBuyuk[y * info.width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return undefined; // renk bulunamadı — kırpma yapma, denetim zaten uyaracak

  const meta = await sharp(foto).metadata();
  const k = meta.width! / info.width;
  const genis = (x1 - x0 + 1) * k;
  const yuksek = (y1 - y0 + 1) * k;
  const payX = Math.max(genis * 0.35, 40);
  const payY = Math.max(yuksek * 0.35, 40);
  const left = Math.max(0, Math.round(x0 * k - payX));
  const top = Math.max(0, Math.round(y0 * k - payY));
  return {
    left,
    top,
    width: Math.min(meta.width! - left, Math.round(genis + payX * 2)),
    height: Math.min(meta.height! - top, Math.round(yuksek + payY * 2)),
  };
}

/* --- ana üretim --- */

export interface UretimSonucu {
  id: string;
  genislik: number;
  yukseklik: number;
  /** Ölçülen gerçek renk — CEVAP. Veri dosyasına işlenir, istemciye gitmez. */
  renk: string;
  /** Bölgenin kapladığı alan yüzdesi — maskenin tuttuğuna dair hızlı bir işaret. */
  oran: number;
  /**
   * Maske İÇİNDEKİ ve DIŞINDAKİ piksellerin ortalama kroması (özgün fotoğrafta).
   *
   * NEDEN OTOMATİK ÖLÇÜLÜYOR: bu işte gözle doğrulama üç kez yanılttı —
   * ekranda "sarı gövde" görünen yer ölçüldüğünde koyu kırmızı yansıma çıktı,
   * "maske ayın içine giriyor" sanılan yerler gerçekten kırmızıydı. İki değer
   * birbirinden AÇIKÇA ayrılmıyorsa maske yanlış bölgeyi tutuyordur; kontrol
   * görüntüsüne bakmadan önce buraya bak.
   */
  icKroma: number;
  disKroma: number;
  /**
   * Fotoğraftan ÖLÇÜLEN renk ile verilen RESMÎ renk arasındaki CIELAB farkı.
   * Büyükse o karenin ışığı bozuk demektir (renkli yansıma, gölge, sarı ampul)
   * ve fotoğraf değiştirilmeli — kanonik konularda foto eleme ölçütü budur.
   * `resmiRenk` verilmediyse 0.
   */
  resmiFark: number;
  /**
   * Sunulan JPEG'te maskeli bölgenin ortalama kroması. Cevabın sızmadığının
   * ölçüsü — sıfıra yakın olmalı (gözlenen: 0,02-0,6).
   */
  sizintiKroma: number;
  /**
   * Maskenin içindeki NÖTR (kroma < 10) piksellerin oranı.
   *
   * Kroma ayrışmasının KÖR NOKTASI için var: maske beyaz/gri bir zemini
   * yutunca ortalama kroma farkı yine de yüksek görünüyor, çünkü nötr
   * pikseller ortalamayı sadece seyreltiyor. Brokolide tam bu oldu — ayrışma
   * 19,8/3,6 ile "iyi" göründü ama maske çizilen dikdörtgenin tamamını
   * kaplıyordu; hatayı ancak ekran görüntüsü gösterdi. Bu oran yüksekse
   * maske bölgeyi değil zemini tutuyordur.
   */
  notrOran: number;
  /**
   * Maskenin DIŞINDA kalıp cevap rengine yakın olan piksel sayısı.
   *
   * OYUNUN EN ÖNEMLİ DENETİMİ: fotoğrafta aynı nesnenin maskelenmemiş bir
   * parçası kalırsa cevap ekranda AÇIKÇA durur. Dört öğede birden yaşandı
   * (limon, nar, avokado, koni) ve dördünün de sebebi aynıydı — bölge beyaz
   * bir şeritle ya da ikinci bir parçayla bölünmüştü, "yalnızca en büyük
   * parçayı tut" kuralı gerisini dışarıda bırakıyordu. Sıfıra yakın olmalı.
   */
  disSizinti: number;
}

export async function uret(tarif: MaskeTarifi, ciktiDizini: string): Promise<UretimSonucu> {
  const kirpRengi = tarif.tohumRenk ?? tarif.resmiRenk;
  const kirp = tarif.otomatikKirp && kirpRengi
    ? await renkCevresineKirp(tarif.foto, kirpRengi)
    : tarif.kirp;

  let boru = sharp(tarif.foto);
  if (kirp) boru = boru.extract(kirp);
  if (tarif.genislik) boru = boru.resize(tarif.genislik);

  const { data, info } = await boru.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  /* Sınıflandırma HAFİF BULANIK bir kopyada yapılıyor, çıktı ise keskin
     özgününden üretiliyor. Sebep: JPEG'in blok gürültüsü tek tek piksellerin
     Lab uzaklığını zıplatıyor ve maske kenarı tırtıklanıyordu (bayrağın ayında
     apaçık görüldü). Bulanıklık yalnızca "bu piksel bölgeye ait mi" kararında. */
  const sinif = await sharp(data, { raw: { width: w, height: h, channels: 3 } })
    .blur(1.1)
    .raw()
    .toBuffer();

  // 1) Elle çizilen kaba sınırı rasterle.
  const sinirYolu = tarif.sinir ?? `M0 0 H${w} V${h} H0 Z`;
  const sinirSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<path d="${sinirYolu}" fill="#fff"/></svg>`;
  const sinirRaw = await sharp(Buffer.from(sinirSvg)).greyscale().raw().toBuffer();

  /**
   * 2a) Tohum verilmediyse OTOMATİK bul: sınırın içindeki RENKLİ piksellerin
   * (kroma > 14) kaba bir Lab histogramını çıkar, en yoğun kutunun ağırlık
   * merkezini tohum yap. Nötr pikseller dışarıda bırakılıyor, yoksa gri arka
   * plan çoğunluğu alıp tohumu oraya çekiyor.
   */
  function otomatikTohum(): [number, number, number][] {
    /* ZEMİNİ ELE. İlk sürüm yalnızca "en kalabalık renkli küme"ye bakıyordu ve
       KOYU/AZ DOYGUN nesnelerde ters çalışıyordu: yaban mersini, kahve
       çekirdeği ve brokolide hafif tonlu beyaz zemin nesneden daha kalabalık
       çıkıp tohum oluyor, maske nesneyi DIŞARIDA bırakıyordu (ölçüm bunu
       kroma içi/dışı değerlerinin ters dönmesiyle yakaladı).
       Çözüm: kenar piksellerinin ortanca rengi zemin sayılıp histogramdan
       çıkarılıyor. Ama bu ancak GERÇEKTEN zemin varsa doğru — bayrak ve tuğla
       duvarı gibi kareyi tamamen dolduran konularda kenar rengi nesnenin ta
       kendisi. Bu yüzden zemin ancak karenin dörtte birinden fazlasını
       kaplıyorsa eleniyor. */
    /* Zemin sayılan yarıçap. 20 denendi ve YETMEDİ: beyaz fonun kendi gölge
       geçişleri (L=100'den L=80'e) o mesafenin dışında kalıp en kalabalık küme
       oluyor, tohum griye kayıyor ve maske tüm zemini yutuyordu (nar ve karpuz
       böyle bozuldu). 32'de fonun tonlamaları içeride kalıyor, nesne ise —
       koyu yaban mersini de dahil — dışarıda. */
    const ZEMIN_YARICAP = 32;
    const kenar: [number, number, number][] = [];
    for (let x = 0; x < w; x += 3) {
      for (const y of [0, 1, h - 2, h - 1]) kenar.push(rgbToLab(sinif[(y * w + x) * 3], sinif[(y * w + x) * 3 + 1], sinif[(y * w + x) * 3 + 2]));
    }
    for (let y = 0; y < h; y += 3) {
      for (const x of [0, 1, w - 2, w - 1]) kenar.push(rgbToLab(sinif[(y * w + x) * 3], sinif[(y * w + x) * 3 + 1], sinif[(y * w + x) * 3 + 2]));
    }
    const ortancaKanal = (k: 0 | 1 | 2) => {
      const v = kenar.map((l) => l[k]).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    const zemin: [number, number, number] = [ortancaKanal(0), ortancaKanal(1), ortancaKanal(2)];
    let zeminSayisi = 0;
    let sinirIci = 0;
    for (let i = 0; i < w * h; i++) {
      if (sinirRaw[i] < 128) continue;
      sinirIci++;
      const lab = rgbToLab(sinif[i * 3], sinif[i * 3 + 1], sinif[i * 3 + 2]);
      if (Math.hypot(lab[0] - zemin[0], lab[1] - zemin[1], lab[2] - zemin[2]) < ZEMIN_YARICAP) zeminSayisi++;
    }
    /* Kenar rengi ancak NÖTR bir stüdyo zemini ise elenir. İlk denemede yalnızca
       "kareyi çok kaplıyor mu" bakılıyordu ve bu, kareyi dolduran RENKLİ
       konularda (tuğla duvarı, bayrak) nesnenin ta kendisini eledi — nar, karpuz
       ve koni de o sırada bozuldu. Doygun bir kenar rengi zemin değil, konudur. */
    const zeminKroma = Math.hypot(zemin[1], zemin[2]);
    const zeminiEle = zeminKroma < 12 && zeminSayisi > sinirIci * 0.2;

    const kutu = 10;
    const sayac = new Map<string, { n: number; L: number; a: number; b: number }>();
    for (let i = 0; i < w * h; i++) {
      if (sinirRaw[i] < 128) continue;
      const lab = rgbToLab(sinif[i * 3], sinif[i * 3 + 1], sinif[i * 3 + 2]);
      if (zeminiEle && Math.hypot(lab[0] - zemin[0], lab[1] - zemin[1], lab[2] - zemin[2]) < ZEMIN_YARICAP) continue;
      if (!zeminiEle && Math.hypot(lab[1], lab[2]) < 14) continue;
      const anahtar = [lab[0], lab[1], lab[2]].map((v) => Math.round(v / kutu)).join(",");
      const k = sayac.get(anahtar) ?? { n: 0, L: 0, a: 0, b: 0 };
      k.n++;
      k.L += lab[0];
      k.a += lab[1];
      k.b += lab[2];
      sayac.set(anahtar, k);
    }
    const sirali = [...sayac.values()].sort((x, y) => y.n - x.n);
    if (!sirali.length) {
      throw new Error(`${tarif.id}: sınır içinde renkli piksel yok — tohumları elle ver.`);
    }
    return sirali.slice(0, 2).map((k) => [k.L / k.n, k.a / k.n, k.b / k.n]);
  }

  /* 2b) Tohum seçimi. KANONİK konularda aranan renk ZATEN BİLİNİYOR — resmî
     değerin kendisi tohum yapılıyor. Histogramla aramak bu grupta işe
     yaramadı: marka rengi karenin küçük bir parçası olduğu için en kalabalık
     küme gökyüzü, masa ya da duvar çıkıyordu (McDonald's tabelasında ölçülen
     fark 95, Pikachu'da 91 idi). Resmî renkten tohumlamak doğrudan hedefi
     gösteriyor; parlaklık ağırlığı düşük tutulunca aynı rengin gölgeli ve
     parlak tonları da giriyor. */
  const tohumLab = tarif.tohumlar?.length
    ? tarif.tohumlar.map(([tx, ty]) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = Math.min(w - 1, Math.max(0, Math.round(tx) + dx));
        const y = Math.min(h - 1, Math.max(0, Math.round(ty) + dy));
        const i = (y * w + x) * 3;
        r += sinif[i];
        g += sinif[i + 1];
        b += sinif[i + 2];
        n++;
      }
    }
      return rgbToLab(r / n, g / n, b / n);
      })
    : (tarif.tohumRenk ?? tarif.resmiRenk)
      ? [rgbToLab(...([1, 3, 5]
          .map((i) => parseInt((tarif.tohumRenk ?? tarif.resmiRenk)!.slice(i, i + 2), 16)) as [number, number, number]))]
      : otomatikTohum();

  // 3) Sınır içinde renk benzerliğine göre YUMUŞAK alfa üret.
  const rampa = tarif.rampa ?? 10;
  const wL = tarif.parlaklikAgirligi ?? 1;
  const yumusak = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (sinirRaw[i] < 128) continue;
    const lab = rgbToLab(sinif[i * 3], sinif[i * 3 + 1], sinif[i * 3 + 2]);
    let enIyi = 0;
    for (const t of tohumLab) {
      const dE = Math.hypot(wL * (lab[0] - t[0]), lab[1] - t[1], lab[2] - t[2]);
      const a = Math.max(0, Math.min(1, (tarif.esik + rampa - dE) / rampa));
      if (a > enIyi) enIyi = a;
      if (enIyi === 1) break;
    }
    yumusak[i] = enIyi;
  }

  /* 4) Temizlik SADECE ÇEKİRDEĞE uygulanıyor (alfa > 0,5), sonra yumuşak alfa
     bu çekirdeğin biraz genişletilmiş haliyle maskeleniyor. Morfolojiyi doğrudan
     yumuşak alfaya uygulamak kenardaki geçişi yiyor, tırtıklı sınır geri
     geliyordu — asıl çözmek istediğimiz şey oydu. */
  let cekirdek: Uint8Array<ArrayBufferLike> = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cekirdek[i] = yumusak[i] > 0.5 ? 1 : 0;
  cekirdek = morfoloji(cekirdek, w, h, 0, 2); // aşındır: kopuk gürültüyü kopar
  cekirdek = morfoloji(cekirdek, w, h, 1, 3); // genişlet: boyu geri ver
  cekirdek = morfoloji(cekirdek, w, h, 0, 1); // aşındır: fazlalığı al
  cekirdek =
    tarif.tekParca === false
      ? buyukBilesenler(cekirdek, w, h, 0.04)
      : enBuyukBilesen(cekirdek, w, h);
  if (tarif.delikleriDoldur) cekirdek = bosluklariDoldur(cekirdek, w, h);
  cekirdek = morfoloji(cekirdek, w, h, 1, tarif.tasma ?? 2);
  const genisCekirdek = morfoloji(cekirdek, w, h, 1, 2);

  const alfaF = new Float32Array(w * h);
  let secili = 0;
  for (let i = 0; i < w * h; i++) {
    if (!genisCekirdek[i]) continue;
    alfaF[i] = cekirdek[i] ? Math.max(yumusak[i], 1) : yumusak[i];
    if (alfaF[i] > 0.5) secili++;
  }
  if (secili < 500) {
    throw new Error(`${tarif.id}: maske neredeyse boş (${secili} piksel) — eşiği/tohumu gözden geçir.`);
  }

  // 5) Gerçek rengi ÖLÇ. Ortalama değil ORTANCAYA yakın bir yüzdelik alınıyor;
  //    ortalama, parlama ve kıvrım gölgeleri yüzünden bölgenin göze görünen
  //    renginden sapıyor.
  const kanallar: number[][] = [[], [], []];
  for (let i = 0; i < w * h; i++) {
    if (alfaF[i] < 0.9) continue; // kenardaki yarı saydam pikseller rengi kirletir
    for (let k = 0; k < 3; k++) kanallar[k].push(data[i * 3 + k]);
  }
  const ortanca = kanallar.map((c) => {
    c.sort((a, b) => a - b);
    return c[Math.floor(c.length * 0.55)];
  });
  const olculen = `#${toHex(ortanca[0])}${toHex(ortanca[1])}${toHex(ortanca[2])}`;
  const renk = tarif.resmiRenk ?? olculen;
  const [rR, rG, rB] = [1, 3, 5].map((i) => parseInt(renk.slice(i, i + 2), 16));
  const lRenk = Math.max(0.04, srgbLum(rR, rG, rB));

  /* 6) Taban görsel: bölge GÖLGE HARİTASINA çevriliyor, renk bilgisi siliniyor.
     Yarı saydam kenar pikselleri özgün renkle alfa oranında karıştırılıyor —
     tam griye çevrilseydi bölgenin çevresinde gri bir hale kalırdı. */
  const taban = Buffer.from(data);
  for (let i = 0; i < w * h; i++) {
    const a = alfaF[i];
    if (a <= 0) continue;
    const l = srgbLum(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    const v = Math.max(0, Math.min(1, l / lRenk)) * 255;
    for (let k = 0; k < 3; k++) {
      taban[i * 3 + k] = Math.round(data[i * 3 + k] * (1 - a) + v * a);
    }
  }

  /* 7) Maske RGBA olarak yazılıyor, gri tonlama olarak DEĞİL. CSS `mask-image`
     varsayılan olarak kaynağın ALFA kanalını okuyor (`mask-mode: match-source`);
     gri tonlamalı, alfası olmayan bir PNG tarayıcıda "her yer opak" demek olur
     ve renk tüm fotoğrafa taşardı. `mask-mode: luminance` ile de çözülebilirdi
     ama alfa kanalı her tarayıcıda varsayılan davranış — ekstra özellik
     desteğine bel bağlamıyor. Kenar zaten yumuşak, ayrıca blur GEREKMİYOR. */
  const alfa = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) alfa[i * 4 + 3] = Math.round(alfaF[i] * 255);

  await mkdir(ciktiDizini, { recursive: true });
  await sharp(taban, { raw: { width: w, height: h, channels: 3 } })
    /* `chromaSubsampling: 4:4:4` ŞART: varsayılan 4:2:0'da JPEG renk kanalını
       yarı çözünürlükte saklıyor ve bölgenin SINIRINDA dışarıdaki renk içeri
       taşıyor — ölçüldüğünde taksinin gri bölgesinde kenara yakın 35 kromaya
       kadar leke çıktı (4 piksel içeride 6'ya düşüyordu, yani cevap değil çevre
       sızıyordu, ama bölgenin "renksiz" olduğu iddiasını kirletiyordu). */
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(path.join(ciktiDizini, `${tarif.id}.jpg`));
  await sharp(alfa, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ciktiDizini, `${tarif.id}.png`));

  // 8) Maskeyi SAYIYLA denetle — gözle doğrulama bu işte tekrar tekrar yanılttı.
  const cevapLab = rgbToLab(rR, rG, rB);
  const cevapKroma = Math.hypot(cevapLab[1], cevapLab[2]);
  const cevapAci = Math.atan2(cevapLab[2], cevapLab[1]);
  const kroma = (r: number, g: number, b: number) => {
    const l = rgbToLab(r, g, b);
    return Math.hypot(l[1], l[2]);
  };
  let icN = 0;
  let icK = 0;
  let disN = 0;
  let disK = 0;
  let sizN = 0;
  let sizK = 0;
  let notrN = 0;
  let disSizinti = 0;
  const tabanRaw = await sharp(path.join(ciktiDizini, `${tarif.id}.jpg`))
    .removeAlpha()
    .raw()
    .toBuffer();
  for (let i = 0; i < w * h; i++) {
    const k = kroma(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    if (alfaF[i] > 0.5) {
      icN++;
      icK += k;
      if (k < 10) notrN++;
      sizN++;
      sizK += kroma(tabanRaw[i * 3], tabanRaw[i * 3 + 1], tabanRaw[i * 3 + 2]);
    } else {
      disN++;
      disK += k;
      /* Cevaba yakın mı? Ölçüt TON + DOYGUNLUK, parlaklık değil.
         İki uç da denendi ve ikisi de hata verdi: parlaklığı kısık ΔE, cevabı
         az doygun olan öğede (yaban mersini) bembeyaz zemini bile "cevaba
         yakın" saydı; TAM ΔE ise bunun tersini kaçırdı — bayrağın gölgede
         kalan kıvrımları maske dışındaydı, apaçık kırmızı görünüyordu ama
         parlaklık farkı yüzünden eşiğin dışında kalıp işaretlenmedi.
         Doğrusu: aynı TONDA ve DOYGUN bir piksel, ne kadar gölgede olursa
         olsun cevabı ele verir. Kroma tabanı da nötr zeminleri eliyor. */
      const c = rgbToLab(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
      const kromaC = Math.hypot(c[1], c[2]);
      if (kromaC > 25 && cevapKroma > 25) {
        const aciFark = Math.abs(
          ((Math.atan2(c[2], c[1]) - cevapAci) * 180) / Math.PI + 540
        ) % 360;
        if (Math.min(aciFark, 360 - aciFark) < 18) disSizinti++;
      }
    }
  }

  return {
    id: tarif.id,
    genislik: w,
    yukseklik: h,
    renk,
    oran: Math.round((secili / (w * h)) * 1000) / 10,
    icKroma: Math.round((icK / Math.max(1, icN)) * 10) / 10,
    disKroma: Math.round((disK / Math.max(1, disN)) * 10) / 10,
    sizintiKroma: Math.round((sizK / Math.max(1, sizN)) * 100) / 100,
    notrOran: Math.round((notrN / Math.max(1, icN)) * 1000) / 10,
    disSizinti,
    resmiFark: tarif.resmiRenk
      ? Math.round(
          Math.hypot(
            ...rgbToLab(ortanca[0], ortanca[1], ortanca[2]).map((v, k) => v - cevapLab[k])
          ) * 10
        ) / 10
      : 0,
  };
}

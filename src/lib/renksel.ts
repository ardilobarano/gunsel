/** Renksel: bir çizimin eksik bırakılmış bölgesinin rengini hatırlayıp bulma oyunu. */
export const GAME_ID = "renksel";

/**
 * Günde kaç soru. TEK: sitedeki diğer oyunlar da günde bir bulmaca veriyor,
 * beş soru Renksel'i tek başına bir oturuma çeviriyordu (kullanıcı kararı).
 * Sorunun kendisinde de tek hak var — düzeltme şansı olsaydı oyuncu kaydırıcıyı
 * deneme yanılmayla dolaştırıp puanı anlamsızlaştırırdı.
 */
export const TUR_SAYISI = 1;

/** Tur başına en yüksek puan; günlük sonuç bunların ortalaması. */
export const TUR_PUANI = 10;

export interface RenkselTur {
  /** "Kot pantolonun rengi" — soru metni. */
  baslik: string;
  kaynak: string;
  /**
   * Fotoğraf — sorulan bölge ÖNCEDEN gri baskılanmış hâliyle. Bölgenin gerçek
   * rengi bu dosyada yok; olsaydı görseli açan cevabı görürdü.
   */
  foto: string;
  /** Bölgenin alfa maskesi (RGBA PNG). Seçilen renk yalnızca buraya biniyor. */
  maske: string;
  /** Kutuyu doğru en/boy oranında ayırmak için — görsel yüklenirken zıplamasın. */
  genislik: number;
  yukseklik: number;
}

export interface RenkselSonuc {
  /** Oyuncunun seçtiği renk. */
  tahmin: string;
  /** Doğru renk — SADECE tur bitince geliyor. */
  dogru: string;
  /** 0-10 arası, bir ondalık. */
  puan: number;
}

/**
 * Türkçe tamlama eki: "SüngerBob'UN pantolonu", "Pikachu'NUN yanakları".
 *
 * Sabit bir ek yazılamıyor — ilk denemede hepsine 'in eklenmişti ve
 * "SüngerBob'in", "Pikachu'in" gibi yanlış çıktılar veriyordu. Ek son ünlüye
 * göre değişiyor (büyük ünlü uyumu) ve sözcük ünlüyle bitiyorsa araya
 * kaynaştırma n'si giriyor.
 */
export function tamlayanEki(ad: string): string {
  const unluler = "aeıioöuüAEIİOÖUÜ";
  const sonUnlu = [...ad].reverse().find((h) => unluler.includes(h)) ?? "e";
  const kalin = "aıouAIOU".includes(sonUnlu);
  const duz = "aeıiAEIİ".includes(sonUnlu);
  const ek = kalin ? (duz ? "ın" : "un") : duz ? "in" : "ün";
  const unluyleBitiyor = unluler.includes(ad[ad.length - 1]);
  return "'" + (unluyleBitiyor ? "n" : "") + ek;
}

/* --- Renk dönüşümleri ---
   HSB (ton/doygunluk/parlaklık) seçiliyor çünkü insan rengi böyle hatırlıyor:
   "kırmızıya yakın, koyu ve canlı". RGB kaydırıcılarıyla aynı şeyi bulmak
   deneme yanılma gerektiriyor. */

export function hsbToHex(h: number, s: number, b: number): string {
  const c = (b / 100) * (s / 100);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = b / 100 - c;
  const [r, g, bl] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const kanal = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${kanal(r)}${kanal(g)}${kanal(bl)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const t = hex.replace("#", "");
  const g = t.length === 3 ? t.split("").map((c) => c + c).join("") : t;
  return [0, 2, 4].map((i) => parseInt(g.slice(i, i + 2), 16)) as [number, number, number];
}

/**
 * sRGB -> CIELAB. Puanlama düz RGB uzaklığıyla YAPILAMAZ: RGB'de eşit uzaklıklar
 * göze eşit görünmüyor, koyu tonlardaki 30 birimlik fark neredeyse fark
 * edilmezken açık tonlarda apaçık oluyor. Lab bu farkı düzeltiyor.
 */
function rgbToLab(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  });
  const x = (r0 * 0.4124 + g0 * 0.3576 + b0 * 0.1805) / 0.95047;
  const y = r0 * 0.2126 + g0 * 0.7152 + b0 * 0.0722;
  const z = (r0 * 0.0193 + g0 * 0.1192 + b0 * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/**
 * CIEDE2000 renk farkı.
 *
 * ÖNCEKİ SÜRÜM ΔE76 KULLANIYORDU (Lab'da düz Öklid mesafesi) VE HAKSIZDI:
 * o formül DOYGUN renkler arasındaki farkı abartıyor. Ölçüldü — birbirine
 * yakın iki kırmızıya ΔE76 "20,6" diyor, CIEDE2000 ise "8,5". Oyuncu ekranda
 * neredeyse aynı iki kırmızı görüp 6,1 puan alıyordu (kullanıcı bildirdi).
 *
 * CIEDE2000 tam bu sorunu düzeltmek için tanımlanmış standart: doygunluk
 * arttıkça farkı S_C/S_H ağırlıklarıyla küçültüyor, açık/koyu uçlarda S_L ile
 * düzeltiyor ve mavi-mor bölgesinde döndürme terimi (R_T) uyguluyor.
 */
function ciede2000(hex1: string, hex2: string): number {
  const [L1, a1, b1] = rgbToLab(hex1);
  const [L2, a2, b2] = rgbToLab(hex2);

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cort = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cort ** 7 / (Cort ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);

  const aci = (b: number, ap: number) => {
    if (b === 0 && ap === 0) return 0;
    const h = (Math.atan2(b, ap) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  };
  const hp1 = aci(b1, ap1);
  const hp2 = aci(b2, ap2);

  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * Math.PI) / 360);

  const Lort = (L1 + L2) / 2;
  const Cport = (Cp1 + Cp2) / 2;
  let hport: number;
  if (Cp1 * Cp2 === 0) {
    hport = hp1 + hp2;
  } else {
    hport = (hp1 + hp2) / 2;
    if (Math.abs(hp1 - hp2) > 180) hport += hp1 + hp2 < 360 ? 180 : -180;
  }

  const T =
    1 -
    0.17 * Math.cos(((hport - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hport * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hport + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hport - 63) * Math.PI) / 180);

  const Sl = 1 + (0.015 * (Lort - 50) ** 2) / Math.sqrt(20 + (Lort - 50) ** 2);
  const Sc = 1 + 0.045 * Cport;
  const Sh = 1 + 0.015 * Cport * T;
  const Rt =
    -Math.sin((2 * (30 * Math.exp(-(((hport - 275) / 25) ** 2))) * Math.PI) / 180) *
    (2 * Math.sqrt(Cport ** 7 / (Cport ** 7 + 25 ** 7)));

  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  );
}

/**
 * Bu CIEDE2000 farkının üstündeki tahminler 0 puan.
 *
 * 45 ÖLÇÜLEREK SEÇİLDİ. Örnek eğri (doğru cevap DUR levhası kırmızısı):
 *   neredeyse aynı ton  ΔE00  1 → 9,8
 *   yakın bir kırmızı         8 → 8,2
 *   saf kırmızı              15 → 6,7
 *   turuncu                  36 → 2,1
 *   mavi (tam ıska)          44 → 0,2
 * 35 denendi, turuncuyu sıfırlıyordu (kırmızıdan turuncu tam ıska değil);
 * 55 denendi, tam ıska maviye 2 puan veriyordu.
 */
const SIFIR_ESIGI = 45;

export function puanla(tahmin: string, dogru: string): number {
  const puan = TUR_PUANI * Math.max(0, 1 - ciede2000(tahmin, dogru) / SIFIR_ESIGI);
  return Math.round(puan * 10) / 10;
}

/** Paylaşım ızgarası — puanı gösteriyor ama RENGİ ele vermiyor. */
export function puanKaresi(puan: number): string {
  if (puan >= 9) return "🟩";
  if (puan >= 7) return "🟨";
  if (puan >= 4) return "🟧";
  return "⬜";
}

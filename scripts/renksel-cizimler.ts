/**
 * Renksel'in KENDİ şematik vektör çizimleri.
 *
 * POLİTİKA (kullanıcı kararı, 2026-08-19): resmî çizim, logo dosyası ya da
 * ekran görüntüsü KOPYALANMIYOR. Bayrak, trafik levhası, standart spor
 * malzemesi gibi konularda zaten telif yok — bunlar serbest alan.
 *
 * NEDEN ÇİZİM BU OYUNA UYUYOR: sorulan şey KANONİK bir renk — düz, tanımlı,
 * ışıktan bağımsız. Fotoğrafta o renk yansıma, gölge ve ampul renginin altında
 * kayboluyordu (içecek kutusu fotoğrafları bu yüzden elendi).
 *
 * ÇİZİM KURALI — KOORDİNAT ELLE YAZILMAZ. İlk denemede yıldızın köşelerini
 * elle yazdım; kolları eşit olmayan, yamuk bir yıldız çıktı ve kullanıcı
 * haklı olarak "çizgiler neden böyle" dedi. Renksel'in en baştaki SVG
 * karakterlerinin beğenilmeme sebebi de aynıydı. Artık bütün çokgen, yıldız ve
 * ölçüler `renksel-geometri.ts`'te HESAPLANIYOR; buradaki değerler ya
 * hesaptan ya da resmî tarifin kendisinden geliyor.
 *
 * Çıktı, fotoğraf boru hattıyla AYNI: `<id>.jpg` (bölgesi silinmiş) +
 * `<id>.png` (alfa maskesi). Uygulama tarafında hiçbir şey değişmiyor.
 */
import {
  besliYildiz,
  dikeyBantlar,
  duzgunCokgen,
  isvicreHaci,
  tenisDikisi,
  turkBayragiOlculeri,
  yatayBantlar,
} from "./renksel-geometri";

export interface RenkselCizim {
  id: string;
  /** Soru metni. */
  baslik: string;
  kaynak: string;
  /** Kanonik renk — CEVAP. */
  renk: string;
  genislik: number;
  yukseklik: number;
  /**
   * SVG gövdesi. Sorulan bölge `{{hedef}}` ile işaretli; üretim sırasında
   * maske bu bölgeden çıkarılıyor, geri kalan her şey olduğu gibi kalıyor.
   */
  svg: string;
}

/** Ortak yumuşak zemin — çizim boşlukta durmasın diye. */
const ZEMIN = `<rect width="100%" height="100%" fill="#f2f0ea"/>`;

/* --- Türk bayrağı: ölçüler kanundan, koordinatlar hesaptan --- */
const G = 480;
const B = turkBayragiOlculeri(G);
const BAYRAK_X = (900 - B.boy) / 2;
const BAYRAK_Y = (600 - B.en) / 2;

/* --- Dur levhası: düzgün sekizgen, üst kenarı yatay (-67,5° başlangıç) --- */
const LEVHA_R = 250;
const LEVHA_IC_R = 250 - 26;

/* --- Tenis topu --- */
const TOP_R = 200;

/* --- Bayraklar: hepsi 2:3 oranında, ortalanmış --- */
const FB = 720; // boy
const FE = 480; // en
const FX = (900 - FB) / 2;
const FY = (600 - FE) / 2;
/** Bayrak çerçevesi — çizimler hep aynı yerde ve aynı boyda dursun. */
const bayrak = (icerik: string) =>
  `${ZEMIN}<g transform="translate(${FX} ${FY})">${icerik}</g>`;

export const CIZIMLER: RenkselCizim[] = [
  {
    id: "turkiye-bayragi",
    baslik: "Türkiye bayrağının zemin rengi",
    kaynak: "Bayrak",
    renk: "#e30a17",
    genislik: 900,
    yukseklik: 600,
    svg: `
${ZEMIN}
<g transform="translate(${BAYRAK_X} ${BAYRAK_Y})">
  <rect width="${B.boy}" height="${B.en}" fill="{{hedef}}"/>
  <circle cx="${B.disCx}" cy="${B.merkezY}" r="${B.disR}" fill="#fff"/>
  <circle cx="${B.icCx}" cy="${B.merkezY}" r="${B.icR}" fill="{{hedef}}"/>
  <polygon points="${besliYildiz(B.yildizCx, B.merkezY, B.yildizR, 180)}" fill="#fff"/>
</g>`,
  },
  {
    id: "dur-levhasi",
    baslik: "Dur levhasının rengi",
    kaynak: "Trafik levhası",
    /* Viyana Sözleşmesi'ne göre B2 "DUR" levhası kırmızısı. */
    renk: "#c8102e",
    genislik: 900,
    yukseklik: 600,
    svg: `
${ZEMIN}
<g transform="translate(450 300)">
  <polygon points="${duzgunCokgen(0, 0, LEVHA_R, 8, -67.5)}" fill="{{hedef}}"/>
  <polygon points="${duzgunCokgen(0, 0, LEVHA_IC_R, 8, -67.5)}" fill="none" stroke="#fff" stroke-width="18"/>
  <text x="0" y="36" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="140" font-weight="700" fill="#fff" letter-spacing="4">DUR</text>
</g>`,
  },
  {
    id: "tenis-topu",
    baslik: "Tenis topunun rengi",
    kaynak: "Spor",
    /* ITF kural kitabı topun sarı ("optic yellow") olmasını şart koşuyor. */
    renk: "#ccff00",
    genislik: 900,
    yukseklik: 600,
    /* Dikişler: uçları çember üzerinde hesaplanan, merkeze doğru şişen iki
       simetrik yay. Ortadan geçen tek bir eğri denendi ve YANLIŞTI — topun
       önden görünüşünde dikiş kenarlara yakın durur. */
    svg: `
${ZEMIN}
<g transform="translate(450 300)">
  <circle r="${TOP_R}" fill="{{hedef}}"/>
  <path d="${tenisDikisi(TOP_R)[0]}" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round"/>
  <path d="${tenisDikisi(TOP_R)[1]}" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round"/>
</g>`,
  },
  {
    id: "japonya-bayragi",
    baslik: "Japonya bayrağındaki dairenin rengi",
    kaynak: "Bayrak",
    /* Japonya'nın resmî bayrak yönetmeliğindeki kırmızı. */
    renk: "#bc002d",
    genislik: 900,
    yukseklik: 600,
    /* Yönetmelik: daire çapı = enin 3/5'i, tam merkezde. */
    svg: bayrak(
      `<rect width="${FB}" height="${FE}" fill="#fff"/>` +
        `<circle cx="${FB / 2}" cy="${FE / 2}" r="${(FE * 3) / 10}" fill="{{hedef}}"/>`
    ),
  },
  {
    id: "fransa-bayragi",
    baslik: "Fransa bayrağındaki mavi bandın rengi",
    kaynak: "Bayrak",
    renk: "#000091",
    genislik: 900,
    yukseklik: 600,
    svg: bayrak(dikeyBantlar(FB, FE, ["{{hedef}}", "#ffffff", "#e1000f"])),
  },
  {
    id: "italya-bayragi",
    baslik: "İtalya bayrağındaki yeşil bandın rengi",
    kaynak: "Bayrak",
    renk: "#008c45",
    genislik: 900,
    yukseklik: 600,
    svg: bayrak(dikeyBantlar(FB, FE, ["{{hedef}}", "#f4f5f0", "#cd212a"])),
  },
  {
    id: "almanya-bayragi",
    baslik: "Almanya bayrağındaki alt bandın rengi",
    kaynak: "Bayrak",
    /* Federal tarife göre altın sarısı. */
    renk: "#ffce00",
    genislik: 900,
    yukseklik: 600,
    svg: bayrak(yatayBantlar(FB, FE, ["#000000", "#dd0000", "{{hedef}}"])),
  },
  {
    id: "isvicre-bayragi",
    baslik: "İsviçre bayrağının zemin rengi",
    kaynak: "Bayrak",
    renk: "#da291c",
    genislik: 900,
    yukseklik: 600,
    /* İsviçre bayrağı KARE; haçın kolları eşit ve boyu genişliğinin 7/6'sı. */
    svg: `${ZEMIN}<g transform="translate(${(900 - FE) / 2} ${FY})">
      <rect width="${FE}" height="${FE}" fill="{{hedef}}"/>
      ${isvicreHaci(FE / 2, FE / 2, FE)}
    </g>`,
  },
  {
    id: "hollanda-bayragi",
    baslik: "Hollanda bayrağındaki üst bandın rengi",
    kaynak: "Bayrak",
    renk: "#ae1c28",
    genislik: 900,
    yukseklik: 600,
    svg: bayrak(yatayBantlar(FB, FE, ["{{hedef}}", "#ffffff", "#21468b"])),
  },
  /* ÇİZGİ FİLM KARAKTERLERİ BURADAN ÇIKARILDI (kullanıcı kararı).
     Şematik çizimler denendi ve yetersiz kaldı — karakterin tanınırlığı kendi
     çizgilerinde, şema onu yakalamıyor. Artık gerçek görselleri kullanılıyor
     (`renksel-karakter-indir.ts` + fotoğraf boru hattı). */
  {
    id: "belcika-bayragi",
    baslik: "Belçika bayrağındaki orta bandın rengi",
    kaynak: "Bayrak",
    renk: "#fdda24",
    genislik: 900,
    yukseklik: 600,
    svg: bayrak(dikeyBantlar(FB, FE, ["#000000", "{{hedef}}", "#ef3340"])),
  },
  {
    id: "danimarka-bayragi",
    baslik: "Danimarka bayrağının zemin rengi",
    kaynak: "Bayrak",
    /* Dannebrog kırmızısı. Dur levhasıyla aynı değere düşmesin diye resmî
       değerine çekildi — iki soru aynı cevabı vermemeli. */
    renk: "#c60c30",
    genislik: 900,
    yukseklik: 600,
    /* Danimarka haçı ortada DEĞİL, direk tarafına kaymış (Nordik haç). */
    svg: bayrak(
      `<rect width="${FB}" height="${FE}" fill="{{hedef}}"/>` +
        `<rect x="0" y="${FE * 0.4}" width="${FB}" height="${FE * 0.2}" fill="#fff"/>` +
        `<rect x="${FB * 0.28}" y="0" width="${FE * 0.2}" height="${FE}" fill="#fff"/>`
    ),
  },
  {
    id: "irlanda-bayragi",
    baslik: "İrlanda bayrağındaki yeşil bandın rengi",
    kaynak: "Bayrak",
    renk: "#169b62",
    genislik: 900,
    yukseklik: 600,
    svg: bayrak(dikeyBantlar(FB, FE, ["{{hedef}}", "#ffffff", "#ff883e"])),
  },
];

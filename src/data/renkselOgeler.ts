/**
 * Renksel'in fotoğrafları ve doğru renkleri.
 *
 * ÇİZİMDEN FOTOĞRAFA GEÇİLDİ (kullanıcı kararı): elle çizilen SVG karakterler
 * yeterince inandırıcı durmuyordu. Artık gerçek fotoğraf kullanılıyor ve
 * bölgenin rengi oyuncunun seçimiyle değişiyor.
 *
 * NASIL ÇALIŞIYOR — üç katman:
 *   1. `<id>.jpg`  fotoğraf, ama sorulan bölge GÖLGE HARİTASINA çevrilmiş (gri).
 *   2. `<id>.png`  o bölgenin alfa maskesi.
 *   3. İstemci maskenin içine seçilen rengi `mix-blend-mode: multiply` ile
 *      bindiriyor — doku, gölge ve kıvrımlar korunuyor, düz boya gibi durmuyor.
 *
 * CEVAP RENGİ İSTEMCİYE GİTMİYOR. Bu, çizim sürümündeki kuralın aynısı ama
 * fotoğrafta bir tuzağı var: fotoğrafı olduğu gibi gönderip bölgeyi tarayıcıda
 * gri tonlamaya çevirmek YETMEZ, altındaki JPEG'te gerçek renk durur ve
 * geliştirici araçlarından görsel açılınca cevap görülür. Bu yüzden bölgesi
 * ÖNCEDEN gri baskılanmış ayrı bir dosya üretiliyor (`npm run renksel:hazirla`);
 * sunulan dosyada o bölgenin renk bilgisi hiç yok. `renk` alanı yalnızca
 * sunucuda okunuyor.
 *
 * VARLIKLARI ÜRETMEK: `scripts/renksel-hazirla.ts`. Maske yarı otomatik —
 * elle çizilen KABA bir sınır + sınır içinde renk benzerliğiyle piksel seçimi.
 * Tarifler `scripts/renksel-kaynaklar.ts`'te, koordinatları okumak için
 * `scripts/renksel-izgara.ts` fotoğrafın üstüne koordinat ızgarası basıyor.
 *
 * FOTOĞRAF KAYNAĞI: Unsplash (Unsplash License — ticari kullanım serbest, atıf
 * ZORUNLU DEĞİL). Kaynak kimliği `unsplashId`'de kayıtlı; atıf gerekmese de
 * bir fotoğrafın nereden geldiğini sonradan bulabilmek için tutuluyor.
 */

export interface RenkselParca {
  /**
   * Soru metninin tamamı ("Kot pantolonun rengi"). Tamlama eki BURADA yazılı,
   * `tamlayanEki` ile üretilmiyor: o kural özel adlar için ("SüngerBob'un")
   * doğru ama fotoğrafların çoğu cins ad ve kesme işareti istemiyor
   * ("Kot pantolon'un" yanlış olurdu).
   */
  baslik: string;
  /** `public/renksel/` altındaki dosya adı, uzantısız. */
  dosya: string;
  genislik: number;
  yukseklik: number;
  /** Doğru renk — betiğin ölçtüğü değer. İstemciye ASLA gönderilmiyor. */
  renk: string;
}

export interface RenkselOge {
  id: string;
  /** Nereden hatırlanacağı — soru metninin altında küçük yazıyla geçiyor. */
  kaynak: string;
  /** Unsplash kaynak kimliği — yalnızca gerçek nesne fotoğraflarında. */
  unsplashId?: string;
  /**
   * Görselin geldiği kaynak sayfası (çizgi film karakterleri için).
   * Kaldırma talebi geldiğinde hangi görselin nereden alındığı buradan
   * görülebilsin diye kodda duruyor — bkz. `Footer.tsx`.
   */
  kaynakUrl?: string;
  /**
   * Görsel BİZİM şematik vektör çizimimiz (`scripts/renksel-cizimler.ts`).
   * Politika: resmî çizim/logo dosyası/ekran görüntüsü kopyalanmıyor.
   */
  kendiCizimimiz?: boolean;
  parcalar: RenkselParca[];
}

export const OGELER: RenkselOge[] = [
  {
    id: "turkiye-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Türkiye bayrağının zemin rengi",
        dosya: "turkiye-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#e30a17",
      },
    ],
  },
  {
    id: "japonya-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Japonya bayrağındaki dairenin rengi",
        dosya: "japonya-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#bc002d",
      },
    ],
  },
  {
    id: "fransa-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Fransa bayrağındaki mavi bandın rengi",
        dosya: "fransa-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#000091",
      },
    ],
  },
  {
    id: "italya-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "İtalya bayrağındaki yeşil bandın rengi",
        dosya: "italya-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#008c45",
      },
    ],
  },
  {
    id: "almanya-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Almanya bayrağındaki alt bandın rengi",
        dosya: "almanya-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#ffce00",
      },
    ],
  },
  {
    id: "isvicre-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "İsviçre bayrağının zemin rengi",
        dosya: "isvicre-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#da291c",
      },
    ],
  },
  {
    id: "hollanda-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Hollanda bayrağındaki üst bandın rengi",
        dosya: "hollanda-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#ae1c28",
      },
    ],
  },
  {
    id: "irlanda-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "İrlanda bayrağındaki yeşil bandın rengi",
        dosya: "irlanda-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#169b62",
      },
    ],
  },
  {
    id: "belcika-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Belçika bayrağındaki orta bandın rengi",
        dosya: "belcika-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#fdda24",
      },
    ],
  },
  {
    id: "danimarka-bayragi",
    kaynak: "Bayrak",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Danimarka bayrağının zemin rengi",
        dosya: "danimarka-bayragi",
        genislik: 900,
        yukseklik: 600,
        renk: "#c60c30",
      },
    ],
  },
  {
    id: "dur-levhasi",
    kaynak: "Trafik levhası",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Dur levhasının rengi",
        dosya: "dur-levhasi",
        genislik: 900,
        yukseklik: 600,
        renk: "#c8102e",
      },
    ],
  },
  {
    id: "tenis-topu",
    kaynak: "Spor",
    kendiCizimimiz: true,
    parcalar: [
      {
        baslik: "Tenis topunun rengi",
        dosya: "tenis-topu",
        genislik: 900,
        yukseklik: 600,
        renk: "#ccff00",
      },
    ],
  },
  {
    id: "sunger-karakter",
    kaynak: "Çizgi film",
    kaynakUrl: "https://spongebob.fandom.com/wiki/File:SpongeBob_SquarePants_stock_art.png",
    parcalar: [
      {
        baslik: "SüngerBob'un gövde rengi",
        dosya: "sunger-karakter",
        genislik: 900,
        yukseklik: 648,
        renk: "#fcef71",
      },
    ],
  },
  {
    id: "sari-fare-karakter",
    kaynak: "Çizgi film",
    kaynakUrl: "https://nintendo.fandom.com/wiki/File:Pikachu.png",
    parcalar: [
      {
        baslik: "Pikachu'nun gövde rengi",
        dosya: "sari-fare-karakter",
        genislik: 900,
        yukseklik: 648,
        renk: "#ffcb05",
      },
    ],
  },
  {
    id: "kulahli-karakter",
    kaynak: "Çizgi film",
    kaynakUrl: "https://smurfs.fandom.com/wiki/File:Papa-smurf.png",
    parcalar: [
      {
        baslik: "Şirin Baba'nın ten rengi",
        dosya: "kulahli-karakter",
        genislik: 900,
        yukseklik: 648,
        renk: "#57b3e6",
      },
    ],
  },
  {
    id: "kirmizi-sapka",
    kaynak: "Video oyunu",
    kaynakUrl: "https://mario.fandom.com/wiki/File:Mario_Artwork_-_New_Super_Mario_Bros.png",
    parcalar: [
      {
        baslik: "Mario'nun şapka ve tişörtünün rengi",
        dosya: "kirmizi-sapka",
        genislik: 900,
        yukseklik: 648,
        renk: "#bd1010",
      },
    ],
  },
  {
    id: "seritli-balik",
    kaynak: "Çizgi film",
    kaynakUrl: "https://disney.fandom.com/wiki/File:Nemo_-_Finding_Nemo_render_01.png",
    parcalar: [
      {
        baslik: "Nemo'nun gövde rengi",
        dosya: "seritli-balik",
        genislik: 900,
        yukseklik: 596,
        renk: "#d85641",
      },
    ],
  },
  {
    id: "taksi",
    kaynak: "İstanbul sokakları",
    unsplashId: "4Y5MV1ycsGM",
    parcalar: [
      {
        baslik: "İstanbul taksisinin rengi",
        dosya: "taksi",
        genislik: 1000,
        yukseklik: 572,
        renk: "#c46903",
      },
    ],
  },
  {
    id: "koni",
    kaynak: "Sokak",
    unsplashId: "p3Ip8U0eNNM",
    parcalar: [
      {
        baslik: "Trafik konisinin rengi",
        dosya: "koni",
        genislik: 900,
        yukseklik: 675,
        renk: "#c4270d",
      },
    ],
  },
  {
    id: "londra-otobusu",
    kaynak: "Taşıt",
    unsplashId: "OK_qY6x5rjk",
    parcalar: [
      {
        baslik: "Londra otobüsünün rengi",
        dosya: "londra-otobusu",
        genislik: 900,
        yukseklik: 592,
        renk: "#dc241f",
      },
    ],
  },
];

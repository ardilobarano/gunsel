/**
 * Haritasal'ın ülke verisini hazırlar: siluet (SVG path), merkez koordinatı ve
 * Türkçe ad. Kaynak: Natural Earth 50m açık GeoJSON (bkz. KAYNAK).
 *
 * Çalıştırma: npm run haritasal:fetch
 *
 * TASARIM NOTU — koordinatlar ÇIKARILIYOR:
 * Siluet, 0-100'lük bir kutuya normalize edilmiş halde saklanıyor; gerçek enlem/boylam
 * path'te YOK. Ham koordinat gönderilseydi oyuncu onu açık bir veri setiyle eşleyip
 * cevabı tahmin etmeden bulabilirdi. Şeklin kendisi zaten bulmacanın ta kendisi,
 * ama konum bilgisi sızmıyor. Mesafe/yön ipuçları sunucuda hesaplanıyor.
 *
 * Yerel eşuzaklık izdüşümü: boylam, ülkenin kendi merkez enlemine göre cos ile
 * düzeltiliyor. Düz lon/lat kullanılsaydı kuzeydeki ülkeler (Rusya, Kanada, İsveç)
 * yatay olarak aşırı gerilip tanınmaz hale gelirdi.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dnsYamasiKur } from "./dns-doh";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outPath = path.join(rootDir, "src", "data", "haritasalCountries.json");

/**
 * Natural Earth 50m. Önceki kaynak (D3-graph-gallery'nin 110m world.geojson'ı)
 * KÜÇÜK ÜLKELERİ leke yapıyordu: Lüksemburg'un ham verisinde topu topu 7 nokta
 * vardı, yani siluet düzgün bir altıgene dönüyor ve tanınacak hiçbir şey
 * kalmıyordu (kullanıcı gerçek cihazda bildirdi). Aynı ülke 50m veride 46 nokta.
 * 173 ülkenin 43'ü 20 noktanın altındaydı — hepsi bu değişiklikten yararlanıyor.
 */
const KAYNAK =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

/** Türkçe ad -> [Türkçe ad, ISO 3166-1 alfa-2]. Anahtar artık İNGİLİZCE AD DEĞİL,
 *  eşleşme ISO koduyla yapılıyor (aşağıdaki `isoIndeksi`): Natural Earth'ün ad
 *  alanları kaynaktan kaynağa değişiyor ama ISO kodu sabit, ve zaten kayıtların
 *  `id`si de o kod. Sadece TANINAN ülkeler listede: bilinmeyen bir ülkede tahmin
 *  rastgeleye döner, oyun tadını kaybeder. */
const ULKELER: Record<string, [string, string]> = {
  Turkey: ["Türkiye", "tr"], Germany: ["Almanya", "de"], France: ["Fransa", "fr"],
  /* Anahtardaki İngilizce adlar artık yalnızca okunurluk için; eşleşme ISO
     koduyla yapılıyor. Eski kaynak Birleşik Krallık'ı Britanya adası olarak
     "England" adıyla veriyordu ve Kuzey İrlanda siluete hiç girmiyordu; ISO ile
     eşleşince ülkenin tamamı geliyor. */
  England: ["Birleşik Krallık", "gb"], Italy: ["İtalya", "it"], Spain: ["İspanya", "es"],
  Netherlands: ["Hollanda", "nl"], Belgium: ["Belçika", "be"], Austria: ["Avusturya", "at"],
  Switzerland: ["İsviçre", "ch"], Sweden: ["İsveç", "se"], Norway: ["Norveç", "no"],
  Denmark: ["Danimarka", "dk"], Finland: ["Finlandiya", "fi"], Poland: ["Polonya", "pl"],
  Greece: ["Yunanistan", "gr"], Portugal: ["Portekiz", "pt"], "Czech Republic": ["Çekya", "cz"],
  Hungary: ["Macaristan", "hu"], Romania: ["Romanya", "ro"], Bulgaria: ["Bulgaristan", "bg"],
  "Republic of Serbia": ["Sırbistan", "rs"], Croatia: ["Hırvatistan", "hr"], Ukraine: ["Ukrayna", "ua"],
  Russia: ["Rusya", "ru"], Ireland: ["İrlanda", "ie"], Iceland: ["İzlanda", "is"],
  Albania: ["Arnavutluk", "al"], "Bosnia and Herzegovina": ["Bosna-Hersek", "ba"],
  USA: ["ABD", "us"], Canada: ["Kanada", "ca"], Mexico: ["Meksika", "mx"],
  Brazil: ["Brezilya", "br"], Argentina: ["Arjantin", "ar"], Chile: ["Şili", "cl"],
  Colombia: ["Kolombiya", "co"], Peru: ["Peru", "pe"], Venezuela: ["Venezuela", "ve"],
  Cuba: ["Küba", "cu"], Bolivia: ["Bolivya", "bo"], Ecuador: ["Ekvador", "ec"],
  Uruguay: ["Uruguay", "uy"], Paraguay: ["Paraguay", "py"],
  China: ["Çin", "cn"], India: ["Hindistan", "in"], Japan: ["Japonya", "jp"],
  "South Korea": ["Güney Kore", "kr"], "North Korea": ["Kuzey Kore", "kp"],
  Indonesia: ["Endonezya", "id"], Pakistan: ["Pakistan", "pk"], Bangladesh: ["Bangladeş", "bd"],
  Vietnam: ["Vietnam", "vn"], Thailand: ["Tayland", "th"], Philippines: ["Filipinler", "ph"],
  Malaysia: ["Malezya", "my"], Myanmar: ["Myanmar", "mm"], Nepal: ["Nepal", "np"],
  Afghanistan: ["Afganistan", "af"], Iran: ["İran", "ir"], Iraq: ["Irak", "iq"],
  "Saudi Arabia": ["Suudi Arabistan", "sa"], Israel: ["İsrail", "il"], Jordan: ["Ürdün", "jo"],
  Lebanon: ["Lübnan", "lb"], Syria: ["Suriye", "sy"], Kuwait: ["Kuveyt", "kw"],
  Azerbaijan: ["Azerbaycan", "az"], Georgia: ["Gürcistan", "ge"], Armenia: ["Ermenistan", "am"],
  Kazakhstan: ["Kazakistan", "kz"], Uzbekistan: ["Özbekistan", "uz"],
  Egypt: ["Mısır", "eg"], Morocco: ["Fas", "ma"], Algeria: ["Cezayir", "dz"],
  Tunisia: ["Tunus", "tn"], Libya: ["Libya", "ly"], Nigeria: ["Nijerya", "ng"],
  Ethiopia: ["Etiyopya", "et"], Kenya: ["Kenya", "ke"], "South Africa": ["Güney Afrika", "za"],
  Ghana: ["Gana", "gh"], "United Republic of Tanzania": ["Tanzanya", "tz"], Uganda: ["Uganda", "ug"],
  Sudan: ["Sudan", "sd"], Somalia: ["Somali", "so"], Madagascar: ["Madagaskar", "mg"],
  Australia: ["Avustralya", "au"], "New Zealand": ["Yeni Zelanda", "nz"],
  /* --- 2026-08 eklemesi: dunyanin geri kalani. Antarktika ve Fransiz Guney
     Topraklari ulke olmadigi icin, KKTC ile Somaliland de ISO kodu/bayragi
     olmadigi icin disarida birakildi. --- */
  Angola: ["Angola", "ao"],
  Belarus: ["Belarus", "by"],
  Belize: ["Belize", "bz"],
  Benin: ["Benin", "bj"],
  Bhutan: ["Butan", "bt"],
  Botswana: ["Botsvana", "bw"],
  Brunei: ["Brunei", "bn"],
  "Burkina Faso": ["Burkina Faso", "bf"],
  Burundi: ["Burundi", "bi"],
  Cambodia: ["Kamboçya", "kh"],
  Cameroon: ["Kamerun", "cm"],
  "Central African Republic": ["Orta Afrika Cumhuriyeti", "cf"],
  Chad: ["Çad", "td"],
  "Costa Rica": ["Kosta Rika", "cr"],
  Cyprus: ["Kıbrıs", "cy"],
  "Democratic Republic of the Congo": ["Kongo Demokratik Cumhuriyeti", "cd"],
  Djibouti: ["Cibuti", "dj"],
  "Dominican Republic": ["Dominik Cumhuriyeti", "do"],
  "East Timor": ["Doğu Timor", "tl"],
  "El Salvador": ["El Salvador", "sv"],
  "Equatorial Guinea": ["Ekvator Ginesi", "gq"],
  Eritrea: ["Eritre", "er"],
  Estonia: ["Estonya", "ee"],
  "Falkland Islands": ["Falkland Adaları", "fk"],
  Fiji: ["Fiji", "fj"],
  Gabon: ["Gabon", "ga"],
  Gambia: ["Gambiya", "gm"],
  Greenland: ["Grönland", "gl"],
  Guatemala: ["Guatemala", "gt"],
  Guinea: ["Gine", "gn"],
  "Guinea Bissau": ["Gine-Bissau", "gw"],
  Guyana: ["Guyana", "gy"],
  Haiti: ["Haiti", "ht"],
  Honduras: ["Honduras", "hn"],
  "Ivory Coast": ["Fildişi Sahili", "ci"],
  Jamaica: ["Jamaika", "jm"],
  Kosovo: ["Kosova", "xk"],
  Kyrgyzstan: ["Kırgızistan", "kg"],
  Laos: ["Laos", "la"],
  Latvia: ["Letonya", "lv"],
  Lesotho: ["Lesotho", "ls"],
  Liberia: ["Liberya", "lr"],
  Lithuania: ["Litvanya", "lt"],
  Luxembourg: ["Lüksemburg", "lu"],
  Macedonia: ["Kuzey Makedonya", "mk"],
  Malawi: ["Malavi", "mw"],
  Mali: ["Mali", "ml"],
  Mauritania: ["Moritanya", "mr"],
  Moldova: ["Moldova", "md"],
  Mongolia: ["Moğolistan", "mn"],
  Montenegro: ["Karadağ", "me"],
  Mozambique: ["Mozambik", "mz"],
  Namibia: ["Namibya", "na"],
  "New Caledonia": ["Yeni Kaledonya", "nc"],
  Nicaragua: ["Nikaragua", "ni"],
  Niger: ["Nijer", "ne"],
  Oman: ["Umman", "om"],
  Panama: ["Panama", "pa"],
  "Papua New Guinea": ["Papua Yeni Gine", "pg"],
  "Puerto Rico": ["Porto Riko", "pr"],
  Qatar: ["Katar", "qa"],
  "Republic of the Congo": ["Kongo Cumhuriyeti", "cg"],
  Rwanda: ["Ruanda", "rw"],
  Senegal: ["Senegal", "sn"],
  "Sierra Leone": ["Sierra Leone", "sl"],
  Slovakia: ["Slovakya", "sk"],
  Slovenia: ["Slovenya", "si"],
  "Solomon Islands": ["Solomon Adaları", "sb"],
  "South Sudan": ["Güney Sudan", "ss"],
  "Sri Lanka": ["Sri Lanka", "lk"],
  Suriname: ["Surinam", "sr"],
  Swaziland: ["Esvatini", "sz"],
  Taiwan: ["Tayvan", "tw"],
  Tajikistan: ["Tacikistan", "tj"],
  "The Bahamas": ["Bahamalar", "bs"],
  Togo: ["Togo", "tg"],
  "Trinidad and Tobago": ["Trinidad ve Tobago", "tt"],
  Turkmenistan: ["Türkmenistan", "tm"],
  "United Arab Emirates": ["Birleşik Arap Emirlikleri", "ae"],
  Vanuatu: ["Vanuatu", "vu"],
  "West Bank": ["Filistin", "ps"],
  "Western Sahara": ["Batı Sahra", "eh"],
  Yemen: ["Yemen", "ye"],
  Zambia: ["Zambiya", "zm"],
  Zimbabwe: ["Zimbabve", "zw"],

};

type Halka = [number, number][];

interface Ozellik {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

/**
 * ISO kodu -> özellik. Üç alan birden taranıyor çünkü Natural Earth bazı
 * ülkelerde `ISO_A2`yi "-99" bırakıyor (Fransa, Norveç, Kosova gibi tartışmalı
 * ya da bağımlı bölgelerde); `ISO_A2_EH` ve `ADM0_ISO` o boşlukları dolduruyor.
 * İlk bulunan kazanıyor ki daha güvenilir alan üzerine yazılmasın.
 */
function isoIndeksi(ozellikler: Ozellik[]): Map<string, Ozellik> {
  const ix = new Map<string, Ozellik>();
  for (const f of ozellikler) {
    for (const alan of ["ISO_A2", "ISO_A2_EH", "ADM0_ISO"]) {
      const kod = String(f.properties[alan] ?? "").toLowerCase();
      if (kod && kod !== "-99" && !ix.has(kod)) ix.set(kod, f);
    }
  }
  return ix;
}

/** Kapalı bir halkanın işaretli alanı — en büyük parçayı ve merkezi bulmak için. */
function alan(halka: Halka): number {
  let a = 0;
  for (let i = 0, j = halka.length - 1; i < halka.length; j = i++) {
    a += halka[j][0] * halka[i][1] - halka[i][0] * halka[j][1];
  }
  return Math.abs(a / 2);
}

function merkez(halka: Halka): [number, number] {
  let x = 0;
  let y = 0;
  for (const [lon, lat] of halka) {
    x += lon;
    y += lat;
  }
  return [x / halka.length, y / halka.length];
}

/** Çok yakın noktaları atarak path'i küçültür — 110m veri zaten kaba, görsel fark yok. */
function seyrelt(halka: Halka, esik: number): Halka {
  const out: Halka = [halka[0]];
  for (const p of halka.slice(1)) {
    const son = out[out.length - 1];
    if (Math.hypot(p[0] - son[0], p[1] - son[1]) >= esik) out.push(p);
  }
  return out.length >= 8 ? out : halka;
}

async function main() {
  /* Kaynak alan adi bu makinede TLS seviyesinde bozuluyor; sifreli DNS ile
     gercek adrese baglaniliyor (gerekce dns-doh.ts icinde). */
  await dnsYamasiKur(["raw.githubusercontent.com"]);
  const res = await fetch(KAYNAK);
  if (!res.ok) throw new Error(`GeoJSON indirilemedi: ${res.status}`);
  const geo = (await res.json()) as { features: Ozellik[] };

  const cikti: {
    id: string;
    label: string;
    flag: string;
    lat: number;
    lon: number;
    path: string;
  }[] = [];
  const eksik: string[] = [];

  const ix = isoIndeksi(geo.features);

  for (const [enAd, [trAd, iso]] of Object.entries(ULKELER)) {
    const f = ix.get(iso);
    if (!f) {
      eksik.push(`${trAd} (${enAd}/${iso})`);
      continue;
    }

    const halkalar: Halka[] =
      f.geometry.type === "Polygon"
        ? [(f.geometry.coordinates as number[][][])[0] as Halka]
        : (f.geometry.coordinates as number[][][][]).map((p) => p[0] as Halka);

    const alanlar = halkalar.map(alan);
    const enBuyuk = Math.max(...alanlar);
    const anaHalka = halkalar[alanlar.indexOf(enBuyuk)];
    const [mLon, mLat] = merkez(anaHalka);

    /* İki eleme, ikisi de siluetin TANINABİLİR kalması için:
       1) Küçük adacıklar (ana parçanın %2'sinden küçük) — tanımaya katkısı yok,
          sadece path'i büyütüyor.
       2) UZAK parçalar. Bu şart: Fransa'nın denizaşırı toprakları (Fransız Guyanası)
          ve ABD'nin Alaska'sı korunduğunda sınırlayıcı kutu bir okyanusu kapsıyor,
          normalize edince anakara minicik bir lekeye dönüşüyordu — Fransa iki nokta
          halinde çıkıyordu. Eşik ana parçanın kendi genişliğine göre: yakın adalar
          (Japonya'nın Hokkaido'su, Yunanistan'ın adaları) kalıyor, okyanus ötesi gidiyor. */
    /* Uzaklık sınırı ÇEKİRDEĞE göre, tek bir parçaya göre değil.
       Eskiden eşik "en büyük parçanın kendi genişliği" idi ve TAKIMADALARI yok
       ediyordu: Vanuatu'nun 14 adasının hepsi alan süzgecini geçiyor ama en büyük
       ada toplam alanın yalnızca %35'i ve komşuları kendi genişliğinden uzakta
       kaldığı için eleniyorlardı — ülke tek bir leke olarak çiziliyordu (kullanıcı
       bildirdi). Solomon Adaları'nda en büyük parça %21, Bahamalar'da %28; hepsi
       aynı sorunu yaşıyordu.
       Yeni ölçüt: parçalar alana göre sıralanıp toplam alanın %90'ını dolduranlar
       "çekirdek" sayılıyor, sınır o çekirdeğin kapladığı kutu. Fransa'da anakara
       tek başına %90'ı dolduruyor, dolayısıyla Fransız Guyanası hâlâ eleniyor;
       Vanuatu'da çekirdek adaların tamamı, hepsi kalıyor. */
    const alanSirali = halkalar
      .map((h, i) => ({ h, a: alanlar[i] }))
      .filter((x) => x.a >= enBuyuk * 0.02)
      .sort((x, y) => y.a - x.a);
    const toplamAlan = alanSirali.reduce((s, x) => s + x.a, 0);
    const cekirdek: Halka[] = [];
    let birikim = 0;
    for (const x of alanSirali) {
      cekirdek.push(x.h);
      birikim += x.a;
      if (birikim >= toplamAlan * 0.9) break;
    }
    const cLon = cekirdek.flat().map((p) => p[0]);
    const cLat = cekirdek.flat().map((p) => p[1]);
    // Kutu biraz genişletiliyor ki çekirdeğe bitişik küçük adalar da kalsın.
    const pay = 0.2;
    const enX = Math.max(...cLon) - Math.min(...cLon);
    const enY = Math.max(...cLat) - Math.min(...cLat);
    const sinir = {
      x1: Math.min(...cLon) - enX * pay,
      x2: Math.max(...cLon) + enX * pay,
      y1: Math.min(...cLat) - enY * pay,
      y2: Math.max(...cLat) + enY * pay,
    };
    const secilen = halkalar.filter((h, i) => {
      if (alanlar[i] < enBuyuk * 0.02) return false;
      const [hLon, hLat] = merkez(h);
      return hLon >= sinir.x1 && hLon <= sinir.x2 && hLat >= sinir.y1 && hLat <= sinir.y2;
    });

    /* Seyreltme eşiği ülkenin KENDİ boyutuna oranlı. Sabit 0,15 derece
       kullanılıyordu ve küçük ülkeleri yok ediyordu: Lüksemburg 0,69 derece
       boyunda, yani eşik ülkenin beşte birine denk geliyor ve geriye tanınacak
       hiçbir çıkıntı kalmıyordu. Bölen 200: siluet en geniş yerinde yaklaşık
       200 parçaya bölünüyor ve ~300 piksellik ekranda zaten daha incesi
       görünmüyor. Üst sınır KONMADI — 0,15'lik bir tavan Rusya ve Kanada'yı
       binlerce noktada tutup dosyayı 496 KB'a çıkarıyordu (ölçüldü), oysa o
       ayrıntının hiçbiri ekranda seçilemiyor. */
    /* Ölçek artık SEÇİLEN parçaların tamamına göre: takımadada tek bir adanın
       genişliğini kullanmak, ekranda çok daha geniş çizilen bütüne göre aşırı
       ince bir eşik veriyordu. */
    const sX = secilen.flat().map((p) => p[0]);
    const sY = secilen.flat().map((p) => p[1]);
    const secilenBoyut = Math.max(
      Math.max(...sX) - Math.min(...sX),
      Math.max(...sY) - Math.min(...sY)
    );
    const esik = secilenBoyut / 200;
    // Yerel eşuzaklık: boylamı merkez enlemin kosinüsüyle daralt.
    const k = Math.cos((mLat * Math.PI) / 180);
    const izdusum = secilen.map((h) => seyrelt(h, esik).map(([lon, lat]) => [lon * k, -lat] as [number, number]));

    const tumX = izdusum.flat().map((p) => p[0]);
    const tumY = izdusum.flat().map((p) => p[1]);
    const minX = Math.min(...tumX);
    const maxX = Math.max(...tumX);
    const minY = Math.min(...tumY);
    const maxY = Math.max(...tumY);
    const olcek = 100 / Math.max(maxX - minX, maxY - minY);
    // Ortala: dar/uzun ülkeler 100x100 kutunun ortasında dursun.
    const kaydirX = (100 - (maxX - minX) * olcek) / 2;
    const kaydirY = (100 - (maxY - minY) * olcek) / 2;

    const d = izdusum
      .map(
        (h) =>
          "M" +
          h
            .map(
              ([x, y]) =>
                `${((x - minX) * olcek + kaydirX).toFixed(1)} ${((y - minY) * olcek + kaydirY).toFixed(1)}`
            )
            .join("L") +
          "Z"
      )
      .join("");

    cikti.push({ id: iso, label: trAd, flag: `https://flagcdn.com/w320/${iso}.png`, lat: mLat, lon: mLon, path: d });
  }

  /* SIRA KRİTİK: günün ülkesi havuzdaki İNDEKSE göre seçiliyor, yani sırayı
     değiştirmek GEÇMİŞ günlerin cevabını da kaydırır. Bu yüzden alfabetik
     sıralama yerine "önce mevcut dosyadaki sıra, sonra yeniler alfabetik"
     kullanılıyor — eski kayıtlar indekslerini koruyor, yeniler sona ekleniyor.
     (bkz. CLAUDE.md'deki HAVUZ BÜYÜTME KURALI) */
  const oncekiSira = new Map<string, number>();
  if (existsSync(outPath)) {
    const onceki = JSON.parse(readFileSync(outPath, "utf8")) as { id: string }[];
    onceki.forEach((u, i) => oncekiSira.set(u.id, i));
  }
  cikti.sort((a, b) => {
    const ai = oncekiSira.get(a.id), bi = oncekiSira.get(b.id);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;          // eskiler her zaman önde
    if (bi !== undefined) return 1;
    return a.label.localeCompare(b.label, "tr");
  });
  writeFileSync(outPath, `${JSON.stringify(cikti, null, 2)}\n`);

  const kb = (JSON.stringify(cikti).length / 1024).toFixed(0);
  console.log(`[tamamlandı] ${cikti.length} ülke yazıldı (${kb} KB): src/data/haritasalCountries.json`);
  if (eksik.length > 0) console.log(`[uyarı] GeoJSON'da bulunamayanlar: ${eksik.join(", ")}`);
}

main();

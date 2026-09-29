/**
 * Haritasal'ın "Türkiye İlleri" sekmesinin verisini hazırlar: il siluetı (SVG path),
 * merkez koordinatı ve plaka kodu.
 *
 * Çalıştırma: npm run haritasal:iller
 *
 * Ülke betiğiyle (fetch-haritasal.ts) aynı tasarım kurallarını izliyor; ORADAKİ
 * gerekçeler burada tekrarlanmadı, yalnızca FARKLAR yazıldı:
 *
 * 1) SEYRELTME EŞİĞİ GÖRECELİ. Ülke betiği sabit 0,15 derece kullanıyor; bir il
 *    çoğu zaman 1-2 derece genişliğinde olduğu için o eşik ilin şeklini tamamen
 *    yok ederdi (üçgene dönüyordu). Eşik burada ilin kendi boyutuna oranlı.
 *
 * 2) BAYRAK YOK, PLAKA VAR. İllerin bayrağı yok; sonuç ekranında bayrak yerine
 *    plaka kodu gösteriliyor, o yüzden veri `plaka` alanı taşıyor.
 *
 * 3) SIRA YİNE KRİTİK ama bu havuz SIFIRDAN başlıyor: günün ili havuzdaki
 *    indekse göre seçildiği için, bir kez yayına girdikten sonra bu 81'in sırası
 *    bir daha değiştirilemez (bkz. CLAUDE.md, HAVUZ BÜYÜTME KURALI). Türkiye'nin
 *    il sayısı sabit olduğu için pratikte büyüme beklenmiyor.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outPath = path.join(rootDir, "src", "data", "haritasalIller.json");

const KAYNAK =
  "https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json";

/**
 * Plaka kodları. Türetilemiyor: 01-67 alfabetik verilmiş ama 68-81 sonradan
 * kurulan iller, alfabetik sıraya girmiyor (Aksaray 68, Düzce 81).
 */
const PLAKALAR: Record<string, number> = {
  Adana: 1, Adıyaman: 2, Afyonkarahisar: 3, Ağrı: 4, Amasya: 5, Ankara: 6,
  Antalya: 7, Artvin: 8, Aydın: 9, Balıkesir: 10, Bilecik: 11, Bingöl: 12,
  Bitlis: 13, Bolu: 14, Burdur: 15, Bursa: 16, Çanakkale: 17, Çankırı: 18,
  Çorum: 19, Denizli: 20, Diyarbakır: 21, Edirne: 22, Elazığ: 23, Erzincan: 24,
  Erzurum: 25, Eskişehir: 26, Gaziantep: 27, Giresun: 28, Gümüşhane: 29,
  Hakkari: 30, Hatay: 31, Isparta: 32, Mersin: 33, İstanbul: 34, İzmir: 35,
  Kars: 36, Kastamonu: 37, Kayseri: 38, Kırklareli: 39, Kırşehir: 40,
  Kocaeli: 41, Konya: 42, Kütahya: 43, Malatya: 44, Manisa: 45,
  Kahramanmaraş: 46, Mardin: 47, Muğla: 48, Muş: 49, Nevşehir: 50, Niğde: 51,
  Ordu: 52, Rize: 53, Sakarya: 54, Samsun: 55, Siirt: 56, Sinop: 57, Sivas: 58,
  Tekirdağ: 59, Tokat: 60, Trabzon: 61, Tunceli: 62, Şanlıurfa: 63, Uşak: 64,
  Van: 65, Yozgat: 66, Zonguldak: 67, Aksaray: 68, Bayburt: 69, Karaman: 70,
  Kırıkkale: 71, Batman: 72, Şırnak: 73, Bartın: 74, Ardahan: 75, Iğdır: 76,
  Yalova: 77, Karabük: 78, Kilis: 79, Osmaniye: 80, Düzce: 81,
};

/** Kaynaktaki ad -> resmi ad. Şapkalı harf BİLEREK yok: arama kutusu şapkayı
 *  katlamıyor, "hakkari" yazan oyuncu "Hakkâri"yi bulamazdı. */
const AD_DUZELTME: Record<string, string> = {
  Afyon: "Afyonkarahisar",
};

type Halka = [number, number][];

interface Ozellik {
  properties: { name?: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

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

function seyrelt(halka: Halka, esik: number): Halka {
  const out: Halka = [halka[0]];
  for (const p of halka.slice(1)) {
    const son = out[out.length - 1];
    if (Math.hypot(p[0] - son[0], p[1] - son[1]) >= esik) out.push(p);
  }
  return out.length >= 8 ? out : halka;
}

async function main() {
  const res = await fetch(KAYNAK);
  if (!res.ok) throw new Error(`GeoJSON indirilemedi: ${res.status}`);
  const geo = (await res.json()) as { features: Ozellik[] };

  const cikti: { id: string; label: string; plaka: number; lat: number; lon: number; path: string }[] = [];
  const eksik: string[] = [];

  for (const f of geo.features) {
    const kaynakAd = f.properties.name;
    if (!kaynakAd) continue;
    const label = AD_DUZELTME[kaynakAd] ?? kaynakAd;
    const plaka = PLAKALAR[label];
    if (!plaka) {
      eksik.push(kaynakAd);
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

    const anaLon = anaHalka.map((p) => p[0]);
    const anaLat = anaHalka.map((p) => p[1]);
    const anaBoyut = Math.max(
      Math.max(...anaLon) - Math.min(...anaLon),
      Math.max(...anaLat) - Math.min(...anaLat)
    );

    /* Adacıkları ele: Çanakkale'nin Gökçeada'sı gibi büyükler kalıyor, tanımaya
       katkısı olmayan noktacıklar gidiyor. */
    const secilen = halkalar.filter((h, i) => {
      if (alanlar[i] < enBuyuk * 0.02) return false;
      const [hLon, hLat] = merkez(h);
      return Math.hypot(hLon - mLon, hLat - mLat) <= anaBoyut;
    });

    // Eşik ilin kendi boyutuna oranlı — bkz. dosya başındaki (1) numaralı not.
    const esik = anaBoyut / 150;
    const k = Math.cos((mLat * Math.PI) / 180);
    const izdusum = secilen.map((h) =>
      seyrelt(h, esik).map(([lon, lat]) => [lon * k, -lat] as [number, number])
    );

    const tumX = izdusum.flat().map((p) => p[0]);
    const tumY = izdusum.flat().map((p) => p[1]);
    const minX = Math.min(...tumX);
    const maxX = Math.max(...tumX);
    const minY = Math.min(...tumY);
    const maxY = Math.max(...tumY);
    const olcek = 100 / Math.max(maxX - minX, maxY - minY);
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

    cikti.push({ id: String(plaka).padStart(2, "0"), label, plaka, lat: mLat, lon: mLon, path: d });
  }

  /* Var olan dosyadaki sıra korunuyor, yeniler sona ekleniyor — ülke betiğiyle
     aynı gerekçe (indeks kayarsa geçmiş günlerin cevabı değişir). */
  const oncekiSira = new Map<string, number>();
  if (existsSync(outPath)) {
    const onceki = JSON.parse(readFileSync(outPath, "utf8")) as { id: string }[];
    onceki.forEach((u, i) => oncekiSira.set(u.id, i));
  }
  cikti.sort((a, b) => {
    const ai = oncekiSira.get(a.id), bi = oncekiSira.get(b.id);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return a.plaka - b.plaka;
  });
  writeFileSync(outPath, `${JSON.stringify(cikti, null, 2)}\n`);

  const kb = (JSON.stringify(cikti).length / 1024).toFixed(0);
  console.log(`[tamamlandı] ${cikti.length} il yazıldı (${kb} KB): src/data/haritasalIller.json`);
  if (eksik.length > 0) console.log(`[uyarı] plaka eşleşmeyenler: ${eksik.join(", ")}`);
}

main();

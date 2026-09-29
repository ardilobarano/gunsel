/**
 * Daha Az/Çok "Nüfus" kategorisinin ÜLKE verisini Dünya Bankası'ndan çeker.
 *
 * Çalıştırma: npm run daha-az-cok:fetch-nufus
 *
 * Neden Dünya Bankası: resmî, sürümlenmiş ve stabil. Denenip ELENEN kaynaklar:
 * - Wikidata SPARQL: sürekli 502/504 veriyor; dahası etiketle eşleştirme yanlış
 *   varlıkları yakalıyor (New York'taki Amsterdam 18 bin nüfusla geldi, Atina
 *   Kanada'dan eşleşti). Oyunun cevabını bozacak veri üretti.
 * - restcountries.com: v3.1 ve v5 uçları "deprecated" dönüyor.
 *
 * Ülke ADLARI burada elle tutuluyor, SAYILAR API'den geliyor. Bu bilinçli:
 * - Türkçe ad ve yazım kontrolümüzde olsun (API'lerin Türkçe çevirileri tutarsız),
 * - havuzda sadece TANINAN ülkeler olsun. Tanınmayan bir ülkede tahmin rastgeleye
 *   döner; oyunun tadı bilinen iki şeyi kıyaslamakta.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outPath = path.join(rootDir, "src", "data", "dahaAzCokNufus.json");

/** ISO 3166-1 alfa-2 -> Türkçe ad. Bayrak görseli de bu koddan türetiliyor. */
const ULKELER: Record<string, string> = {
  TR: "Türkiye", DE: "Almanya", FR: "Fransa", GB: "Birleşik Krallık", IT: "İtalya",
  ES: "İspanya", NL: "Hollanda", BE: "Belçika", AT: "Avusturya", CH: "İsviçre",
  SE: "İsveç", NO: "Norveç", DK: "Danimarka", FI: "Finlandiya", PL: "Polonya",
  GR: "Yunanistan", PT: "Portekiz", CZ: "Çekya", HU: "Macaristan", RO: "Romanya",
  BG: "Bulgaristan", RS: "Sırbistan", HR: "Hırvatistan", UA: "Ukrayna", RU: "Rusya",
  US: "ABD", CA: "Kanada", MX: "Meksika", BR: "Brezilya", AR: "Arjantin",
  CL: "Şili", CO: "Kolombiya", PE: "Peru", VE: "Venezuela", CU: "Küba",
  CN: "Çin", IN: "Hindistan", JP: "Japonya", KR: "Güney Kore", KP: "Kuzey Kore",
  ID: "Endonezya", PK: "Pakistan", BD: "Bangladeş", VN: "Vietnam", TH: "Tayland",
  PH: "Filipinler", MY: "Malezya", SG: "Singapur", MM: "Myanmar", NP: "Nepal",
  AF: "Afganistan", IR: "İran", IQ: "Irak", SA: "Suudi Arabistan", AE: "BAE",
  IL: "İsrail", JO: "Ürdün", LB: "Lübnan", SY: "Suriye", QA: "Katar",
  KW: "Kuveyt", AZ: "Azerbaycan", GE: "Gürcistan", AM: "Ermenistan", KZ: "Kazakistan",
  UZ: "Özbekistan", EG: "Mısır", MA: "Fas", DZ: "Cezayir", TN: "Tunus",
  LY: "Libya", NG: "Nijerya", ET: "Etiyopya", KE: "Kenya", ZA: "Güney Afrika",
  GH: "Gana", TZ: "Tanzanya", UG: "Uganda", SD: "Sudan", CD: "Kongo DC",
  AU: "Avustralya", NZ: "Yeni Zelanda", IE: "İrlanda", IS: "İzlanda", CY: "Kıbrıs",
};

interface WorldBankRow {
  countryiso3code?: string;
  country?: { id?: string; value?: string };
  value?: number | null;
}

interface Item {
  id: string;
  label: string;
  value: number;
  unit: string;
  imageUrl: string;
}


/**
 * ŞEHİRLER — metropol alan nüfusları, elle derlenmiş ve doğrulanmış.
 * API'den gelmiyor: şehir nüfusu tanımı kaynaktan kaynağa değişiyor (şehir sınırı mı,
 * metropol alan mı) ve denenen otomatik kaynaklar tutarsız/yanlış veri verdi.
 * Ülkelerle AYNI havuzda duruyorlar: birim aynı ("kişi"), dolayısıyla
 * "İstanbul mu Hollanda mı daha kalabalık" gibi kıyaslar geçerli ve oyunu
 * daha ilginç yapıyor. "(şehir)" eki şart — yoksa Meksiko/Meksika,
 * New York/ABD gibi çiftler karışıyor.
 */
const SEHIRLER: Item[] = [
  { id: "sehir-tokyo", label: "Tokyo (şehir)", value: 37400000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/jp.png" },
  { id: "sehir-jakarta", label: "Jakarta (şehir)", value: 35000000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/id.png" },
  { id: "sehir-delhi", label: "Delhi (şehir)", value: 32900000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/in.png" },
  { id: "sehir-shanghai", label: "Şangay (şehir)", value: 29200000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/cn.png" },
  { id: "sehir-seoul", label: "Seul (şehir)", value: 25600000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/kr.png" },
  { id: "sehir-dhaka", label: "Dakka (şehir)", value: 23900000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/bd.png" },
  { id: "sehir-saopaulo", label: "São Paulo (şehir)", value: 22600000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/br.png" },
  { id: "sehir-mexicocity", label: "Meksiko (şehir)", value: 22300000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/mx.png" },
  { id: "sehir-cairo", label: "Kahire (şehir)", value: 21800000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/eg.png" },
  { id: "sehir-mumbai", label: "Mumbai (şehir)", value: 21300000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/in.png" },
  { id: "sehir-beijing", label: "Pekin (şehir)", value: 21000000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/cn.png" },
  { id: "sehir-osaka", label: "Osaka (şehir)", value: 19100000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/jp.png" },
  { id: "sehir-newyork", label: "New York (şehir)", value: 18800000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/us.png" },
  { id: "sehir-karachi", label: "Karaçi (şehir)", value: 17600000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/pk.png" },
  { id: "sehir-buenosaires", label: "Buenos Aires (şehir)", value: 15600000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/ar.png" },
  { id: "sehir-istanbul", label: "İstanbul (şehir)", value: 15500000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/tr.png" },
  { id: "sehir-lagos", label: "Lagos (şehir)", value: 15300000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/ng.png" },
  { id: "sehir-moscow", label: "Moskova (şehir)", value: 12700000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/ru.png" },
  { id: "sehir-paris", label: "Paris (şehir)", value: 11100000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/fr.png" },
  { id: "sehir-bangkok", label: "Bangkok (şehir)", value: 10700000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/th.png" },
  { id: "sehir-london", label: "Londra (şehir)", value: 9600000, unit: "kişi", imageUrl: "https://flagcdn.com/w320/gb.png" },
];

async function main() {
  // date belirtilmiyor: en güncel yıl neyse onu alsın (mrv=1 = most recent value).
  const url =
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=400&mrnev=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dünya Bankası isteği başarısız: ${res.status}`);

  const json = (await res.json()) as [unknown, WorldBankRow[] | null];
  const rows = json[1] ?? [];

  const items: Item[] = [];
  const eksik: string[] = [];

  for (const [kod, ad] of Object.entries(ULKELER)) {
    // country.id iki harfli ISO alfa-2 kodu döner.
    const row = rows.find((r) => r.country?.id === kod && typeof r.value === "number");
    if (!row || typeof row.value !== "number") {
      eksik.push(`${ad} (${kod})`);
      continue;
    }
    items.push({
      id: kod.toLowerCase(),
      label: ad,
      value: row.value,
      unit: "kişi",
      imageUrl: `https://flagcdn.com/w320/${kod.toLowerCase()}.png`,
    });
  }

  items.push(...SEHIRLER);
  items.sort((a, b) => b.value - a.value);
  writeFileSync(outPath, `${JSON.stringify(items, null, 2)}\n`);

  console.log(`[tamamlandı] ${items.length} öğe yazıldı (${items.length - SEHIRLER.length} ülke + ${SEHIRLER.length} şehir): src/data/dahaAzCokNufus.json`);
  if (eksik.length > 0) console.log(`[uyarı] veri bulunamayanlar: ${eksik.join(", ")}`);
  console.log(`  en kalabalık: ${items[0].label} ${items[0].value.toLocaleString("tr-TR")}`);
  console.log(`  en az       : ${items[items.length - 1].label} ${items[items.length - 1].value.toLocaleString("tr-TR")}`);
}

main();

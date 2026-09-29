/**
 * Daha Az/Çok'un Trivia ve Fiyat kartlarına görsel ekler.
 *
 * Neden gerekti: Nüfus bayrak (flagcdn), Film ve Dizi afiş (TMDB) gösteriyordu
 * ama Trivia ve Fiyat kartları düz metin kutusuydu — aynı oyunun içinde iki farklı
 * kart türü duruyordu.
 *
 * Kaynak: Wikipedia'nın REST "summary" ucu. Anahtar gerektirmiyor ve dağ, nehir,
 * hayvan, gezegen, element, şirket gibi birbirinden alakasız konuların hepsini
 * tek uçtan veriyor — TMDB yalnızca yapımları, flagcdn yalnızca ülkeleri biliyor.
 *
 * Önce tr.wikipedia, bulunamazsa en.wikipedia deneniyor: Türkçe madde çoğu zaman
 * var ama "Yay başlı balina" gibi bazı türlerin Türkçe maddesi yok.
 *
 * LİSANS NOTU: Wikipedia görsellerinin çoğu CC-BY-SA, yani ATIF İSTİYOR. Oyun
 * herkese açılmadan önce sayfaya "Görseller: Wikipedia" gibi bir künye eklenmeli.
 *
 * Çalıştırma: npm run daha-az-cok:gorseller
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

interface Oge {
  id: string;
  label: string;
  value: number;
  unit: string;
  imageUrl?: string;
}

/**
 * Wikipedia'da farklı adla geçen ya da etiketten türetilemeyen maddeler.
 * Boş string "bu öğeye görsel arama" demek (uygun/temiz bir görseli yok).
 */
const MADDE_ADI: Record<string, string> = {
  // Trivia — hayvanlar
  "Yay başlı balina": "Bowhead whale",
  "Galapagos kaplumbağası": "Galápagos tortoise",
  "Ara papağanı": "Ara (cins)",
  "Amerikan antilobu": "Pronghorn",
  "Gökdoğan (dalışta)": "Gökdoğan",
  "İnsan (en hızlı koşucu)": "Usain Bolt",
  "İnsan (dünya ortalaması)": "İnsan",
  "İnsan (ortalama)": "İnsan",
  "Beyaz gergedan": "Beyaz gergedan",
  "Su aygırı": "Su aygırı",
  "Boz ayı": "Boz ayı",
  "Mavi balina": "Mavi balina",
  /* Türkçe'de bu adlar ANLAM AYRIMI sayfası: "Satürn" hem gezegen hem tanrı,
     "Fare" hem hayvan hem bilgisayar faresi. Ayrım sayfası atlandığı için
     (görseli konuyla ilgisiz bir simge) doğru madde açıkça yazılıyor. */
  Satürn: "Satürn (gezegen)",
  Fare: "Fare (hayvan)",
  "Afrika fili": "Afrika fili",
  "Ob Nehri": "Ob River",
  "Dicle Nehri": "Dicle",
  Denali: "Denali",
  // Trivia — diğer
  "Buz (su)": "Buz",
  "Sarı Irmak": "Sarı Irmak",
  "Mississippi-Missouri": "Mississippi Nehri",
  "Masa Dağı": "Masa Dağı",
  "Kaz Dağı": "Kaz Dağları",

  /* Fiyat — şirket adı Wikipedia'da farklı yazılıyor ya da etiketteki kısaltma
     tek başına anlam ayrımına düşüyor. Anahtar TAM ETİKET olmak zorunda: eşleme
     etiketten şirket çıkarılmadan ÖNCE bakılıyor. */
  "EMC (Dell, 2016)": "Dell EMC",
  "Slack (Salesforce, 2021)": "Slack (yazılım)",
  "Mojang / Minecraft (Microsoft, 2014)": "Mojang Studios",
  "ZeniMax / Bethesda (Microsoft, 2021)": "ZeniMax Media",
  "Whole Foods (Amazon, 2017)": "Whole Foods Market",
  "Oculus (Facebook, 2014)": "Oculus VR",
  "Kiva Systems (Amazon, 2012)": "Amazon Robotics",
  "Yahoo (Verizon, 2017)": "Yahoo!",
  "Beats Electronics (Apple, 2014)": "Beats Electronics",
  "ARM (SoftBank, 2016)": "Arm Holdings",
  "VMware (Broadcom, 2023)": "VMware",
  "Tableau (Salesforce, 2019)": "Tableau Software",
  "Nuance (Microsoft, 2022)": "Nuance Communications",
  "DoubleClick (Google, 2007)": "DoubleClick",
  "Mandiant (Google, 2022)": "Mandiant",
  "Marketo (Adobe, 2018)": "Marketo",
  "Shazam (Apple, 2018)": "Shazam (uygulama)",
  "HashiCorp (IBM, 2024)": "HashiCorp",
  "Maxim Integrated (Analog Devices, 2021)": "Maxim Integrated",
  "Inphi (Marvell, 2021)": "Inphi",
  "Broadcast.com (Yahoo, 1999)": "Broadcast.com",
  "Wiz (Google, 2025)": "Wiz (şirket)",
  "Run:ai (Nvidia, 2024)": "Run:ai",
};

/** Etiketten aranacak madde adını çıkarır. */
function maddeAdi(label: string): string {
  if (MADDE_ADI[label] !== undefined) return MADDE_ADI[label];

  /* Fiyat etiketleri iki biçimde: "AT&T - Time Warner (2018)" ve
     "21st Century Fox (Disney, 2019)". İkisinde de aranacak özne SATIN ALINAN
     şirket — ilkinde tireden sonrası, ikincisinde parantezden öncesi. */
  const tireli = label.match(/^.+? - (.+?) \(\d{4}\)$/);
  if (tireli) return tireli[1];

  // Kalan her şeyde sondaki parantezli ek atılıyor ("Everest Dağı (8849 m)" gibi).
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wikipedia HIZ SINIRLI ve sessizce sınırlıyor: art arda istek atınca 429
 * dönüyor, `!res.ok` dalına düşüyor ve öğe "görseli yok" diye işaretleniyordu.
 * İlk denemede 104 Trivia öğesinin ancak 35'i geçti, gerisi aslında VARDI.
 * Bu yüzden istekler arasında bekleniyor ve 429'da artan aralıkla yeniden
 * deneniyor; 404 (madde yok) yeniden denenmiyor, o gerçek bir "yok" cevabı.
 */
async function istek(url: string, deneme = 0): Promise<Response | null> {
  const res = await fetch(url, { headers: { "User-Agent": "gunsel.app (puzzle site)" } });
  if (res.status === 429 && deneme < 4) {
    await bekle(2000 * (deneme + 1));
    return istek(url, deneme + 1);
  }
  return res.ok ? res : null;
}

async function gorselBul(ad: string): Promise<string | null> {
  if (!ad) return null;
  for (const dil of ["tr", "en"]) {
    const url = `https://${dil}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ad)}`;
    await bekle(250);
    const res = await istek(url);
    if (!res) continue;
    const data = (await res.json()) as {
      thumbnail?: { source?: string };
      type?: string;
    };
    /* Anlam ayrımı sayfalarının görseli konuyla ilgisiz bir simge oluyor. */
    if (data.type === "disambiguation") continue;
    if (data.thumbnail?.source) return data.thumbnail.source;
  }
  return null;
}

async function dosyayiIsle(dosya: string) {
  const yol = path.join(rootDir, "src", "data", dosya);
  const ogeler = JSON.parse(readFileSync(yol, "utf8")) as Oge[];

  let eklendi = 0;
  const eksik: string[] = [];

  for (const oge of ogeler) {
    if (oge.imageUrl) continue;
    const url = await gorselBul(maddeAdi(oge.label));
    if (url) {
      oge.imageUrl = url;
      eklendi++;
    } else {
      eksik.push(oge.label);
    }
  }

  writeFileSync(yol, `${JSON.stringify(ogeler, null, 2)}\n`);
  const toplam = ogeler.filter((o) => o.imageUrl).length;
  console.log(`${dosya}: +${eklendi} görsel, toplam ${toplam}/${ogeler.length}`);
  if (eksik.length > 0) console.log(`  bulunamadı (${eksik.length}): ${eksik.join(", ")}`);
}

async function main() {
  for (const d of ["dahaAzCokTrivia.json", "dahaAzCokFiyat.json"]) await dosyayiIsle(d);
}

main();

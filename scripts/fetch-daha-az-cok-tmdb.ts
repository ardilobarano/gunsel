/**
 * Daha Az/Çok'un Film ve Dizi havuzlarını TMDB'den üretir.
 *
 * NEDEN TMDB: Havuzlar eskiden ELLE girilmiş IMDB puanlarıydı (ör. Shawshank 9.3).
 * Havuzu büyütmek için yeni IMDB puanlarını ezberden yazmak gerekirdi ve tek bir
 * yanlış rakam oyunun yanlış cevap vermesi demek. TMDB API'si hem doğrulanabilir hem
 * afişi de aynı çağrıda veriyor. Kaynak KARIŞTIRILAMAZ: TMDB puanı IMDB'den sistematik
 * olarak düşük (8.7 vs 9.3), bu yüzden havuzun TAMAMI TMDB'den yeniden üretiliyor.
 *
 * Listede kasten geniş bir puan aralığı var (ünlü klasiklerden orta karar popülerlere)
 * — hepsi 8.5+ olsaydı karşılaştırmalar yazı-tura olurdu.
 *
 * Çalıştırma: npm run daha-az-cok:fetch-tmdb
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * EKLE MODU (varsayılan): mevcut dosyadaki kayıtlara DOKUNULMAZ, sadece listede
 * olup dosyada olmayanlar çekilip sonuna eklenir.
 *
 * Neden varsayılan bu: günün zinciri havuzun tamamı karılarak seçiliyor, yani
 * hem sıra hem değerler geçmiş günlerin cevabını belirliyor. Havuzu baştan
 * üretmek iki şeyi birden bozardı — sıra değişir (arşivdeki her gün başka bir
 * zincir gösterir) ve TMDB puanları zamanla oynadığı için eski bir
 * karşılaştırmanın DOĞRU CEVABI değişebilir (8.6 -> 8.5 bir çifti ters çevirir).
 *
 * `--sifirdan` ile eski davranış (her şeyi yeniden üret) geri gelir; havuzu
 * bilerek baştan kurmak istenirse kullanılmalı.
 */
const SIFIRDAN = process.argv.includes("--sifirdan");

if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY tanımlı değil (.env.local kontrol et).");
  process.exit(1);
}
const API_KEY = process.env.TMDB_API_KEY;

interface Sorgu {
  ad: string;
  yil: number;
}

interface Oge {
  id: string;
  label: string;
  value: number;
  unit: string;
  imageUrl: string | null;
}

const FILMLER: Sorgu[] = [
  { ad: "The Shawshank Redemption", yil: 1994 },
  { ad: "The Godfather", yil: 1972 },
  { ad: "The Dark Knight", yil: 2008 },
  { ad: "12 Angry Men", yil: 1957 },
  { ad: "Schindler's List", yil: 1993 },
  { ad: "Pulp Fiction", yil: 1994 },
  { ad: "Forrest Gump", yil: 1994 },
  { ad: "Fight Club", yil: 1999 },
  { ad: "Inception", yil: 2010 },
  { ad: "Interstellar", yil: 2014 },
  { ad: "The Matrix", yil: 1999 },
  { ad: "Goodfellas", yil: 1990 },
  { ad: "Se7en", yil: 1995 },
  { ad: "Gladiator", yil: 2000 },
  { ad: "Parasite", yil: 2019 },
  { ad: "Whiplash", yil: 2014 },
  { ad: "The Green Mile", yil: 1999 },
  { ad: "The Lion King", yil: 1994 },
  { ad: "Spirited Away", yil: 2001 },
  { ad: "Joker", yil: 2019 },
  { ad: "Titanic", yil: 1997 },
  { ad: "Avatar", yil: 2009 },
  { ad: "Jurassic Park", yil: 1993 },
  { ad: "Back to the Future", yil: 1985 },
  { ad: "Django Unchained", yil: 2012 },
  { ad: "The Prestige", yil: 2006 },
  { ad: "Shutter Island", yil: 2010 },
  { ad: "La La Land", yil: 2016 },
  { ad: "The Wolf of Wall Street", yil: 2013 },
  { ad: "Mad Max: Fury Road", yil: 2015 },
  { ad: "The Grand Budapest Hotel", yil: 2014 },
  { ad: "Oppenheimer", yil: 2023 },
  { ad: "Barbie", yil: 2023 },
  { ad: "Dune", yil: 2021 },
  { ad: "Top Gun: Maverick", yil: 2022 },
  { ad: "Get Out", yil: 2017 },
  { ad: "Deadpool", yil: 2016 },
  { ad: "Frozen", yil: 2013 },
  { ad: "Shrek", yil: 2001 },
  { ad: "Ice Age", yil: 2002 },
  { ad: "Home Alone", yil: 1990 },
  { ad: "The Fast and the Furious", yil: 2001 },
  { ad: "Transformers", yil: 2007 },
  { ad: "Twilight", yil: 2008 },
  { ad: "Suicide Squad", yil: 2016 },
  { ad: "Cats", yil: 2019 },
  { ad: "Eşkıya", yil: 1996 },
  { ad: "Babam ve Oğlum", yil: 2005 },
  { ad: "Kış Uykusu", yil: 2014 },
  { ad: "G.O.R.A.", yil: 2004 },

  /* --- 2026-08 eklemesi. Havuzun SONUNA eklendi, üsttekilerin sırası
     korunmalı (bkz. EKLE MODU açıklaması). --- */
  { ad: "The Lord of the Rings: The Fellowship of the Ring", yil: 2001 },
  { ad: "The Lord of the Rings: The Two Towers", yil: 2002 },
  { ad: "The Lord of the Rings: The Return of the King", yil: 2003 },
  { ad: "Star Wars", yil: 1977 },
  { ad: "The Empire Strikes Back", yil: 1980 },
  { ad: "Alien", yil: 1979 },
  { ad: "Aliens", yil: 1986 },
  { ad: "Terminator 2: Judgment Day", yil: 1991 },
  { ad: "The Silence of the Lambs", yil: 1991 },
  { ad: "Saving Private Ryan", yil: 1998 },
  { ad: "The Departed", yil: 2006 },
  { ad: "Memento", yil: 2000 },
  { ad: "Casablanca", yil: 1943 }, // TMDB yayın yılı 1943 (ABD vizyonu)
  { ad: "Psycho", yil: 1960 },
  { ad: "Rear Window", yil: 1954 },
  { ad: "2001: A Space Odyssey", yil: 1968 },
  { ad: "A Clockwork Orange", yil: 1971 },
  { ad: "The Shining", yil: 1980 },
  { ad: "Taxi Driver", yil: 1976 },
  { ad: "Apocalypse Now", yil: 1979 },
  { ad: "Once Upon a Time in America", yil: 1984 },
  { ad: "The Great Dictator", yil: 1940 },
  { ad: "Modern Times", yil: 1936 },
  { ad: "Cinema Paradiso", yil: 1988 },
  { ad: "Life Is Beautiful", yil: 1997 },
  { ad: "Amélie", yil: 2001 },
  { ad: "Oldboy", yil: 2003 },
  { ad: "Senin Adın", yil: 2016 }, // "Your Name" araması alakasız bir yapımı yakalıyordu
  { ad: "Princess Mononoke", yil: 1997 },
  { ad: "Grave of the Fireflies", yil: 1988 },
  { ad: "My Neighbor Totoro", yil: 1988 },
  { ad: "Howl's Moving Castle", yil: 2004 },
  { ad: "Coco", yil: 2017 },
  { ad: "Up", yil: 2009 },
  { ad: "WALL·E", yil: 2008 },
  { ad: "Toy Story", yil: 1995 },
  { ad: "Toy Story 3", yil: 2010 },
  { ad: "Finding Nemo", yil: 2003 },
  { ad: "Inside Out", yil: 2015 },
  { ad: "Ratatouille", yil: 2007 },
  { ad: "Monsters, Inc.", yil: 2001 },
  { ad: "The Incredibles", yil: 2004 },
  { ad: "How to Train Your Dragon", yil: 2010 },
  { ad: "Kung Fu Panda", yil: 2008 },
  { ad: "Madagascar", yil: 2005 },
  { ad: "Despicable Me", yil: 2010 },
  { ad: "Minions", yil: 2015 },
  { ad: "The Avengers", yil: 2012 },
  { ad: "Avengers: Infinity War", yil: 2018 },
  { ad: "Avengers: Endgame", yil: 2019 },
  { ad: "Iron Man", yil: 2008 },
  { ad: "Guardians of the Galaxy", yil: 2014 },
  { ad: "Spider-Man: Into the Spider-Verse", yil: 2018 },
  { ad: "Black Panther", yil: 2018 },
  { ad: "Logan", yil: 2017 },
  { ad: "The Batman", yil: 2022 },
  { ad: "Batman Begins", yil: 2005 },
  { ad: "The Dark Knight Rises", yil: 2012 },
  { ad: "Venom", yil: 2018 },
  { ad: "Morbius", yil: 2022 },
  { ad: "Fantastic Four", yil: 2015 },
  { ad: "Jaws", yil: 1975 },
  { ad: "E.T. the Extra-Terrestrial", yil: 1982 },
  { ad: "Raiders of the Lost Ark", yil: 1981 },
  { ad: "Rocky", yil: 1976 },
  { ad: "The Truman Show", yil: 1998 },
  { ad: "Good Will Hunting", yil: 1997 },
  { ad: "A Beautiful Mind", yil: 2001 },
  { ad: "Slumdog Millionaire", yil: 2008 },
  { ad: "The Pianist", yil: 2002 },
  { ad: "No Country for Old Men", yil: 2007 },
  { ad: "There Will Be Blood", yil: 2007 },
  { ad: "Blade Runner", yil: 1982 },
  { ad: "Blade Runner 2049", yil: 2017 },
  { ad: "Arrival", yil: 2016 },
  { ad: "Gravity", yil: 2013 },
  { ad: "The Martian", yil: 2015 },
  { ad: "Ex Machina", yil: 2015 },
  { ad: "Her", yil: 2013 },
  { ad: "Everything Everywhere All at Once", yil: 2022 },
  { ad: "Knives Out", yil: 2019 },
  { ad: "1917", yil: 2019 },
  { ad: "Bohemian Rhapsody", yil: 2018 },
  { ad: "The Social Network", yil: 2010 },
  { ad: "Catch Me If You Can", yil: 2002 },
  { ad: "The Sixth Sense", yil: 1999 },
  { ad: "Gone Girl", yil: 2014 },
  { ad: "Zodiac", yil: 2007 },
  { ad: "American Beauty", yil: 1999 },
  { ad: "Requiem for a Dream", yil: 2000 },
  { ad: "Trainspotting", yil: 1996 },
  { ad: "Reservoir Dogs", yil: 1992 },
  { ad: "Kill Bill: Vol. 1", yil: 2003 },
  { ad: "Inglourious Basterds", yil: 2009 },
  { ad: "Once Upon a Time... in Hollywood", yil: 2019 },
  { ad: "Dunkirk", yil: 2017 },
  { ad: "Tenet", yil: 2020 },
  { ad: "Dune: Part Two", yil: 2024 },
  { ad: "Poor Things", yil: 2023 },
  { ad: "The Substance", yil: 2024 },
  { ad: "Sonic the Hedgehog", yil: 2020 },
  { ad: "Jumanji: Welcome to the Jungle", yil: 2017 },
  { ad: "Pirates of the Caribbean: The Curse of the Black Pearl", yil: 2003 },
  { ad: "Harry Potter and the Philosopher's Stone", yil: 2001 },
  { ad: "Harry Potter and the Prisoner of Azkaban", yil: 2004 },
  { ad: "The Hunger Games", yil: 2012 },
  { ad: "Fifty Shades of Grey", yil: 2015 },
  { ad: "Battlefield Earth", yil: 2000 },

  /* Türk yapımları */
  { ad: "Ayla", yil: 2017 },
  { ad: "Müslüm", yil: 2018 },
  { ad: "Recep İvedik", yil: 2008 },
  { ad: "Düğün Dernek", yil: 2013 },
  { ad: "Vizontele", yil: 2001 },
  { ad: "Hokkabaz", yil: 2006 },
  { ad: "Organize İşler", yil: 2005 },
  { ad: "Kelebeğin Rüyası", yil: 2013 },
  { ad: "Bir Zamanlar Anadolu'da", yil: 2011 },
  { ad: "Üç Maymun", yil: 2008 },
  { ad: "Uzak", yil: 2002 },
  { ad: "Ahlat Ağacı", yil: 2018 },
  { ad: "Fetih 1453", yil: 2012 },
  { ad: "Neşeli Hayat", yil: 2009 },
  { ad: "Aile Arasında", yil: 2017 },
  { ad: "Selvi Boylum Al Yazmalım", yil: 1977 },
  { ad: "Sürü", yil: 1978 },
  { ad: "Yol", yil: 1982 },
  { ad: "Tosun Paşa", yil: 1976 },
  { ad: "Hababam Sınıfı", yil: 1975 },
  { ad: "Süt Kardeşler", yil: 1976 },
  { ad: "Kurtlar Vadisi: Irak", yil: 2006 },
];

const DIZILER: Sorgu[] = [
  { ad: "Breaking Bad", yil: 2008 },
  { ad: "Game of Thrones", yil: 2011 },
  { ad: "The Sopranos", yil: 1999 },
  { ad: "The Wire", yil: 2002 },
  { ad: "Chernobyl", yil: 2019 },
  { ad: "Band of Brothers", yil: 2001 },
  { ad: "Sherlock", yil: 2010 },
  { ad: "Dark", yil: 2017 },
  { ad: "Stranger Things", yil: 2016 },
  { ad: "The Office", yil: 2005 },
  { ad: "Friends", yil: 1994 },
  { ad: "Seinfeld", yil: 1989 },
  { ad: "How I Met Your Mother", yil: 2005 },
  { ad: "The Big Bang Theory", yil: 2007 },
  { ad: "Better Call Saul", yil: 2015 },
  { ad: "True Detective", yil: 2014 },
  { ad: "Mr. Robot", yil: 2015 },
  { ad: "Peaky Blinders", yil: 2013 },
  { ad: "Narcos", yil: 2015 },
  { ad: "Money Heist", yil: 2017 },
  { ad: "The Crown", yil: 2016 },
  { ad: "The Mandalorian", yil: 2019 },
  { ad: "House of the Dragon", yil: 2022 },
  { ad: "The Last of Us", yil: 2023 },
  { ad: "Squid Game", yil: 2021 },
  { ad: "Wednesday", yil: 2022 },
  { ad: "The Witcher", yil: 2019 },
  { ad: "Black Mirror", yil: 2011 },
  { ad: "Rick and Morty", yil: 2013 },
  { ad: "Avatar: The Last Airbender", yil: 2005 },
  { ad: "Attack on Titan", yil: 2013 },
  { ad: "Death Note", yil: 2006 },
  { ad: "Lost", yil: 2004 },
  { ad: "Prison Break", yil: 2005 },
  { ad: "Dexter", yil: 2006 },
  { ad: "House", yil: 2004 },
  { ad: "Grey's Anatomy", yil: 2005 },
  { ad: "The Walking Dead", yil: 2010 },
  { ad: "Vikings", yil: 2013 },
  { ad: "Emily in Paris", yil: 2020 },

  /* --- 2026-08 eklemesi. Havuzun SONUNA eklendi. --- */
  { ad: "Fargo", yil: 2014 },
  { ad: "Westworld", yil: 2016 },
  { ad: "The Boys", yil: 2019 },
  { ad: "Succession", yil: 2018 },
  { ad: "Ted Lasso", yil: 2020 },
  { ad: "The Bear", yil: 2022 },
  { ad: "Severance", yil: 2022 },
  { ad: "Yellowstone", yil: 2018 },
  { ad: "Ozark", yil: 2017 },
  { ad: "Mindhunter", yil: 2017 },
  { ad: "The Haunting of Hill House", yil: 2018 },
  { ad: "The Queen's Gambit", yil: 2020 },
  { ad: "Watchmen", yil: 2019 },
  { ad: "Loki", yil: 2021 },
  { ad: "WandaVision", yil: 2021 },
  { ad: "Andor", yil: 2022 },
  { ad: "Obi-Wan Kenobi", yil: 2022 },
  { ad: "Arcane", yil: 2021 },
  { ad: "One Piece", yil: 1999 },
  { ad: "Naruto", yil: 2002 },
  { ad: "Fullmetal Alchemist: Brotherhood", yil: 2009 },
  { ad: "Hunter x Hunter", yil: 2011 },
  { ad: "Demon Slayer: Kimetsu no Yaiba", yil: 2019 },
  { ad: "Jujutsu Kaisen", yil: 2020 },
  { ad: "My Hero Academia", yil: 2016 },
  { ad: "Cowboy Bebop", yil: 1998 },
  { ad: "Neon Genesis Evangelion", yil: 1995 },
  { ad: "The Simpsons", yil: 1989 },
  { ad: "Family Guy", yil: 1999 },
  { ad: "South Park", yil: 1997 },
  { ad: "Futurama", yil: 1999 },
  { ad: "BoJack Horseman", yil: 2014 },
  { ad: "Community", yil: 2009 },
  { ad: "Parks and Recreation", yil: 2009 },
  { ad: "Brooklyn Nine-Nine", yil: 2013 },
  { ad: "Modern Family", yil: 2009 },
  { ad: "Two and a Half Men", yil: 2003 },
  { ad: "Scrubs", yil: 2001 },
  { ad: "The X-Files", yil: 1993 },
  { ad: "Twin Peaks", yil: 1990 },
  { ad: "Buffy the Vampire Slayer", yil: 1997 },
  { ad: "Supernatural", yil: 2005 },
  { ad: "Sons of Anarchy", yil: 2008 },
  { ad: "Boardwalk Empire", yil: 2010 },
  { ad: "Rome", yil: 2005 },
  { ad: "Spartacus", yil: 2010 },
  { ad: "The Handmaid's Tale", yil: 2017 },
  { ad: "Homeland", yil: 2011 },
  { ad: "24", yil: 2001 },
  { ad: "Suits", yil: 2011 },
  { ad: "Fleabag", yil: 2016 },
  { ad: "Killing Eve", yil: 2018 },
  { ad: "The Umbrella Academy", yil: 2019 },
  { ad: "Lucifer", yil: 2016 },
  { ad: "Riverdale", yil: 2017 },
  { ad: "13 Reasons Why", yil: 2017 },
  { ad: "You", yil: 2018 },
  { ad: "Bridgerton", yil: 2020 },
  { ad: "Downton Abbey", yil: 2010 },
  { ad: "Gilmore Girls", yil: 2000 },
  { ad: "Desperate Housewives", yil: 2004 },
  { ad: "Sex and the City", yil: 1998 },
  { ad: "Gossip Girl", yil: 2007 },
  { ad: "Elite", yil: 2018 },
  { ad: "Lupin", yil: 2021 },
  { ad: "Kingdom", yil: 2019 },
  { ad: "Alice in Borderland", yil: 2020 },
  { ad: "All of Us Are Dead", yil: 2022 },
  { ad: "Hellbound", yil: 2021 },

  /* Türk yapımları */
  { ad: "Muhteşem Yüzyıl", yil: 2011 },
  { ad: "Diriliş: Ertuğrul", yil: 2014 },
  { ad: "Çukur", yil: 2017 },
  { ad: "Ezel", yil: 2009 },
  { ad: "Kurtlar Vadisi Pusu", yil: 2007 },
  { ad: "Behzat Ç. Bir Ankara Polisiyesi", yil: 2010 },
  { ad: "Leyla ile Mecnun", yil: 2011 },
  { ad: "Bir Başkadır", yil: 2020 },
  { ad: "Aşk-ı Memnu", yil: 2008 },
  { ad: "Yaprak Dökümü", yil: 2006 },
  { ad: "Kuzey Güney", yil: 2011 },
  { ad: "Şahsiyet", yil: 2018 },
  { ad: "Masumlar Apartmanı", yil: 2020 },
  { ad: "Avrupa Yakası", yil: 2004 },
  { ad: "Çocuklar Duymasın", yil: 2002 },
];

async function ara(tur: "movie" | "tv", { ad, yil }: Sorgu) {
  const params = new URLSearchParams({ api_key: API_KEY, query: ad, language: "tr-TR" });
  params.set(tur === "movie" ? "primary_release_year" : "first_air_date_year", String(yil));

  const res = await fetch(`https://api.themoviedb.org/3/search/${tur}?${params.toString()}`);
  if (!res.ok) throw new Error(`TMDB arama başarısız (${res.status})`);
  const data = (await res.json()) as {
    results?: { id: number; title?: string; name?: string; vote_average: number; vote_count: number; poster_path: string | null }[];
  };
  return data.results?.[0] ?? null;
}

function mevcutOku(dosya: string): Oge[] {
  const yol = path.join(rootDir, "src", "data", dosya);
  if (SIFIRDAN || !existsSync(yol)) return [];
  return JSON.parse(readFileSync(yol, "utf8")) as Oge[];
}

async function havuzUret(
  tur: "movie" | "tv",
  sorgular: Sorgu[],
  onEk: string,
  mevcut: Oge[],
): Promise<Oge[]> {
  /* Mevcut kayıtlar SIRASI BOZULMADAN başta kalıyor; yeni bulunanlar sona
     ekleniyor. Sıra korunmazsa geçmiş günlerin zinciri değişir. */
  const mevcutIdler = new Set(mevcut.map((o) => o.id));
  const yeniler: Oge[] = [];
  let korunan = 0;

  for (const s of sorgular) {
    const bulunan = await ara(tur, s);
    if (!bulunan) {
      console.log(`  [atlandı] "${s.ad}" bulunamadı`);
      continue;
    }
    const id = `${onEk}-${bulunan.id}`;
    if (mevcutIdler.has(id)) {
      korunan++;
      continue;
    }
    /* Az oylu yapımların puanı güvenilmez (3 kişi 10 vermiş olabilir).
       Eşik 200'den 120'ye indirildi: TMDB'de Türk yapımlarının oy sayısı düşük
       ve 200'de Muhteşem Yüzyıl dışında TÜM Türk dizileri eleniyordu — Türkçe
       bir oyunda dizi kategorisinin tamamen yabancı yapımlardan oluşması daha
       büyük bir kusur. 120 oyda ortalama hâlâ ±0,15 bandında oturuyor. */
    if (bulunan.vote_count < 120) {
      console.log(`  [atlandı] "${s.ad}" yetersiz oy (${bulunan.vote_count})`);
      continue;
    }
    /* Aynı yapım listede iki farklı adla geçebilir (ör. Türkçe/İngilizce ad);
       aynı TMDB id'si iki kez eklenirse oyunda "X mi X mi" çıkardı. */
    if (yeniler.some((o) => o.id === id)) {
      console.log(`  [atlandı] "${s.ad}" listede zaten var (${id})`);
      continue;
    }
    const ad = bulunan.title ?? bulunan.name ?? s.ad;
    yeniler.push({
      id,
      label: ad,
      value: Math.round(bulunan.vote_average * 10) / 10,
      unit: "puan",
      imageUrl: bulunan.poster_path ? `https://image.tmdb.org/t/p/w500${bulunan.poster_path}` : null,
    });
    console.log(`  + ${ad.padEnd(34)} ${bulunan.vote_average.toFixed(1)} puan (${bulunan.vote_count} oy)`);
  }

  console.log(`  (${korunan} kayıt zaten havuzda, dokunulmadı)`);
  return [...mevcut, ...yeniler];
}

async function main() {
  console.log(SIFIRDAN ? "MOD: sıfırdan üretim" : "MOD: ekle (mevcut kayıtlara dokunulmuyor)");
  console.log("\n=== FİLMLER ===");
  const filmler = await havuzUret("movie", FILMLER, "film", mevcutOku("dahaAzCokFilm.json"));
  console.log("\n=== DİZİLER ===");
  const diziler = await havuzUret("tv", DIZILER, "dizi", mevcutOku("dahaAzCokDizi.json"));

  writeFileSync(path.join(rootDir, "src", "data", "dahaAzCokFilm.json"), `${JSON.stringify(filmler, null, 2)}\n`);
  writeFileSync(path.join(rootDir, "src", "data", "dahaAzCokDizi.json"), `${JSON.stringify(diziler, null, 2)}\n`);

  const araligi = (l: Oge[]) => `${Math.min(...l.map((x) => x.value))} - ${Math.max(...l.map((x) => x.value))}`;
  console.log(`\n[tamamlandı] film: ${filmler.length} öğe (puan aralığı ${araligi(filmler)})`);
  console.log(`             dizi: ${diziler.length} öğe (puan aralığı ${araligi(diziler)})`);
}

main();

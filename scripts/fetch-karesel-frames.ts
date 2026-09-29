/**
 * Karesel'in film karesi havuzunu TMDB'den otomatik üretir.
 *
 * MOVIE_TITLES'taki her başlık için TMDB'de arama yapar, filmin "backdrop"ları
 * (sahne kareleri) arasından SADECE yazısız olanları seçer ve 6 kareyi zorluk
 * sırasına dizip src/data/kareselMovies.json'a yazar.
 *
 * Neden sadece yazısız kareler: TMDB backdrop'larının bir kısmı üzerinde film
 * adının yazılı olduğu promosyon görselleri. iso_639_1 alanı bir dil kodu ise
 * (ör. "en", "tr") görselde metin var demektir; null ise saf sahne karesi.
 * Cevabı ele vermemek için sadece null olanları alıyoruz.
 *
 * Kare sıralaması: TMDB backdrop'ları oylamaya göre (en ikonik/tanıdık önce)
 * sıralı döndürüyor. Biz TERSTEN alıyoruz — ilk kare en bilinmedik, son kare en
 * tanıdık olsun diye, oyun zorlaşmaktan kolaylaşmaya doğru aksın (Framed mantığı).
 *
 * Çalıştırma: npm run karesel:fetch-frames
 * Havuza film eklemek için MOVIE_TITLES'a başlık ekleyip tekrar çalıştır.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FRAME_COUNT } from "../src/lib/karesel";
import { SERIES_TITLES } from "./karesel-dizi-listesi";
import { dnsYamasiKur } from "./dns-doh";

/* --tur dizi ile ayni betik TMDB nin TV uclarini kullaniyor. Ayri bir betik
   yazmak kare secme, ayni sahne eleme ve ffmpeg kurulumunu ikiye kopyalamak
   demekti; TMDB nin film/TV uclari alan adlari disinda ayni. */
const DIZI_MODU = process.argv.includes("--dizi");
const TUR = DIZI_MODU ? "tv" : "movie";
const TUR_ADI = DIZI_MODU ? "dizi" : "film";

/* ffmpeg: once PATH, sonra winget yolu. Sarkisal script i ile ayni yaklasim -
   surum kontrolu TEK tireli "-version" ister, "--version" hata veriyor. */
const ffmpegYolu = (() => {
  const adaylar = [
    "ffmpeg",
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft/WinGet/Links/ffmpeg.exe"),
  ];
  for (const a of adaylar) {
    try { execFileSync(a, ["-version"], { stdio: "ignore" }); return a; } catch {}
  }
  throw new Error("ffmpeg bulunamadi - kare benzerlik suzgeci icin gerekli.");
})();

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outPath = path.join(rootDir, "src", "data", DIZI_MODU ? "kareselSeries.json" : "kareselMovies.json");

if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY tanımlı değil (.env.local kontrol et).");
  process.exit(1);
}
const API_KEY = process.env.TMDB_API_KEY;

/** Bir filmin havuza girebilmesi için gereken en az yazısız kare sayısı. */
const MIN_TEXTLESS_BACKDROPS = FRAME_COUNT;

/** Aynı ada sahip birden fazla film olduğunda doğru olanı seçmek için yıl verilir
 * (ör. "Parasite" yıl verilmezse 1982 yapımı alakasız bir filmi yakalıyor). */
interface MovieQuery {
  title: string;
  year?: number;
}

const MOVIE_TITLES: MovieQuery[] = [
  // --- Türk sineması ---
  { title: "Eşkıya", year: 1996 },
  { title: "Babam ve Oğlum", year: 2005 },
  { title: "G.O.R.A.", year: 2004 },
  { title: "Vizontele", year: 2001 },
  { title: "Kış Uykusu", year: 2014 },
  { title: "Ayla", year: 2017 },
  { title: "Organize İşler", year: 2005 },
  { title: "Hokkabaz", year: 2006 },
  { title: "Üç Maymun", year: 2008 },
  { title: "Yedinci Koğuştaki Mucize", year: 2019 },
  { title: "Müslüm", year: 2018 },
  { title: "Nefes: Vatan Sağolsun", year: 2009 },
  { title: "Bir Zamanlar Anadolu'da", year: 2011 },
  { title: "Uzak", year: 2002 },
  { title: "Ahlat Ağacı", year: 2018 },
  { title: "İklimler", year: 2006 },
  { title: "Kelebeğin Rüyası", year: 2013 },
  { title: "Düğün Dernek", year: 2013 },
  { title: "Çakallarla Dans", year: 2010 },
  { title: "Aile Arasında", year: 2017 },
  { title: "Kabadayı", year: 2007 },
  { title: "Av Mevsimi", year: 2010 },
  { title: "Pek Yakında", year: 2014 },
  { title: "Bergen", year: 2021 },
  { title: "Kurak Günler", year: 2022 },
  { title: "Hababam Sınıfı", year: 1975 },
  { title: "Selvi Boylum Al Yazmalım", year: 1977 },
  { title: "Yol", year: 1982 },
  { title: "Sürü", year: 1978 },
  { title: "Züğürt Ağa", year: 1985 },
  { title: "Muhsin Bey", year: 1987 },
  { title: "Propaganda", year: 1999 },
  // --- Dünya sineması: klasikler ve modern kültler ---
  { title: "Inception", year: 2010 },
  { title: "The Dark Knight", year: 2008 },
  { title: "Interstellar", year: 2014 },
  { title: "The Matrix", year: 1999 },
  { title: "Forrest Gump", year: 1994 },
  { title: "Titanic", year: 1997 },
  { title: "Pulp Fiction", year: 1994 },
  { title: "Fight Club", year: 1999 },
  { title: "The Godfather", year: 1972 },
  { title: "The Godfather Part II", year: 1974 },
  { title: "The Shawshank Redemption", year: 1994 },
  { title: "Gladiator", year: 2000 },
  { title: "Joker", year: 2019 },
  { title: "Parasite", year: 2019 },
  { title: "The Lion King", year: 1994 },
  { title: "Jurassic Park", year: 1993 },
  { title: "Back to the Future", year: 1985 },
  { title: "Léon: The Professional", year: 1994 },
  { title: "Se7en", year: 1995 },
  { title: "The Prestige", year: 2006 },
  { title: "Django Unchained", year: 2012 },
  { title: "Avatar", year: 2009 },
  { title: "The Silence of the Lambs", year: 1991 },
  { title: "Schindler's List", year: 1993 },
  { title: "Whiplash", year: 2014 },
  { title: "La La Land", year: 2016 },
  { title: "Spirited Away", year: 2001 },
  { title: "The Truman Show", year: 1998 },
  { title: "The Green Mile", year: 1999 },
  { title: "Shutter Island", year: 2010 },
  { title: "Catch Me If You Can", year: 2002 },
  { title: "Home Alone", year: 1990 },
  { title: "Terminator 2: Judgment Day", year: 1991 },
  { title: "Alien", year: 1979 },
  { title: "The Shining", year: 1980 },
  { title: "Goodfellas", year: 1990 },
  { title: "The Departed", year: 2006 },
  { title: "Taxi Driver", year: 1976 },
  { title: "Scarface", year: 1983 },
  { title: "Heat", year: 1995 },
  { title: "Casino", year: 1995 },
  { title: "Once Upon a Time in America", year: 1984 },
  { title: "The Good, the Bad and the Ugly", year: 1966 },
  { title: "Apocalypse Now", year: 1979 },
  { title: "Full Metal Jacket", year: 1987 },
  { title: "Saving Private Ryan", year: 1998 },
  { title: "Braveheart", year: 1995 },
  { title: "One Flew Over the Cuckoo's Nest", year: 1975 },
  { title: "12 Angry Men", year: 1957 },
  { title: "2001: A Space Odyssey", year: 1968 },
  { title: "Blade Runner", year: 1982 },
  { title: "Blade Runner 2049", year: 2017 },
  { title: "Mad Max: Fury Road", year: 2015 },
  { title: "The Grand Budapest Hotel", year: 2014 },
  { title: "No Country for Old Men", year: 2007 },
  { title: "There Will Be Blood", year: 2007 },
  { title: "The Big Lebowski", year: 1998 },
  { title: "Reservoir Dogs", year: 1992 },
  { title: "Inglourious Basterds", year: 2009 },
  { title: "Kill Bill: Vol. 1", year: 2003 },
  { title: "The Wolf of Wall Street", year: 2013 },
  { title: "The Revenant", year: 2015 },
  { title: "Birdman", year: 2014 },
  { title: "Gravity", year: 2013 },
  { title: "Arrival", year: 2016 },
  { title: "Dune", year: 2021 },
  { title: "Oppenheimer", year: 2023 },
  { title: "Barbie", year: 2023 },
  { title: "Everything Everywhere All at Once", year: 2022 },
  { title: "Get Out", year: 2017 },
  { title: "Hereditary", year: 2018 },
  { title: "A Quiet Place", year: 2018 },
  { title: "Gone Girl", year: 2014 },
  { title: "Prisoners", year: 2013 },
  { title: "Zodiac", year: 2007 },
  { title: "The Social Network", year: 2010 },
  { title: "Slumdog Millionaire", year: 2008 },
  { title: "The Pursuit of Happyness", year: 2006 },
  { title: "Cast Away", year: 2000 },
  { title: "American Beauty", year: 1999 },
  { title: "Requiem for a Dream", year: 2000 },
  { title: "Memento", year: 2000 },
  { title: "Eternal Sunshine of the Spotless Mind", year: 2004 },
  { title: "Amélie", year: 2001 },
  { title: "Cinema Paradiso", year: 1988 },
  { title: "Life Is Beautiful", year: 1997 },
  { title: "City of God", year: 2002 },
  { title: "Oldboy", year: 2003 },
  { title: "Train to Busan", year: 2016 },
  { title: "Your Name.", year: 2016 },
  { title: "Princess Mononoke", year: 1997 },
  { title: "My Neighbor Totoro", year: 1988 },
  { title: "Howl's Moving Castle", year: 2004 },
  { title: "Good Will Hunting", year: 1997 },
  { title: "Dead Poets Society", year: 1989 },
  { title: "Rain Man", year: 1988 },
  { title: "Rocky", year: 1976 },
  { title: "Jaws", year: 1975 },
  { title: "E.T. the Extra-Terrestrial", year: 1982 },
  { title: "Raiders of the Lost Ark", year: 1981 },
  // --- Animasyon ---
  { title: "Toy Story", year: 1995 },
  { title: "Finding Nemo", year: 2003 },
  { title: "Up", year: 2009 },
  { title: "WALL·E", year: 2008 },
  { title: "Inside Out", year: 2015 },
  { title: "Coco", year: 2017 },
  { title: "Ratatouille", year: 2007 },
  { title: "Monsters, Inc.", year: 2001 },
  { title: "The Incredibles", year: 2004 },
  { title: "Shrek", year: 2001 },
  { title: "Frozen", year: 2013 },
  { title: "Zootopia", year: 2016 },
  { title: "How to Train Your Dragon", year: 2010 },
  { title: "Kung Fu Panda", year: 2008 },
  { title: "Spider-Man: Into the Spider-Verse", year: 2018 },
  // --- Blockbuster / seri ---
  { title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001 },
  { title: "The Lord of the Rings: The Two Towers", year: 2002 },
  { title: "The Lord of the Rings: The Return of the King", year: 2003 },
  { title: "Star Wars", year: 1977 },
  { title: "The Empire Strikes Back", year: 1980 },
  { title: "Harry Potter and the Philosopher's Stone", year: 2001 },
  { title: "Harry Potter and the Prisoner of Azkaban", year: 2004 },
  { title: "The Avengers", year: 2012 },
  { title: "Avengers: Infinity War", year: 2018 },
  { title: "Avengers: Endgame", year: 2019 },
  { title: "Iron Man", year: 2008 },
  { title: "Guardians of the Galaxy", year: 2014 },
  { title: "Black Panther", year: 2018 },
  { title: "Deadpool", year: 2016 },
  { title: "Logan", year: 2017 },
  { title: "The Batman", year: 2022 },
  { title: "Casino Royale", year: 2006 },
  { title: "Skyfall", year: 2012 },
  { title: "John Wick", year: 2014 },
  { title: "Taken", year: 2008 },
  { title: "Top Gun: Maverick", year: 2022 },
  { title: "Pirates of the Caribbean: The Curse of the Black Pearl", year: 2003 },
  { title: "The Fast and the Furious", year: 2001 },
  // --- 2. genişletme: Türk sineması ---
  { title: "Issız Adam", year: 2008 },
  { title: "Aşk Tesadüfleri Sever", year: 2011 },
  { title: "İncir Reçeli", year: 2011 },
  { title: "Romantik Komedi", year: 2010 },
  { title: "Eyvah Eyvah", year: 2010 },
  { title: "Kolpaçino", year: 2009 },
  { title: "Recep İvedik 2", year: 2009 },
  { title: "Arif v 216", year: 2018 },
  { title: "Cebimdeki Yabancı", year: 2018 },
  { title: "Deliha", year: 2014 },
  { title: "Kocan Kadar Konuş", year: 2015 },
  { title: "Dedemin Fişi", year: 2016 },
  { title: "Neredesin Firuze", year: 2004 },
  { title: "Vizontele Tuuba", year: 2004 },
  { title: "Beyaz Melek", year: 2007 },
  { title: "Yumurta", year: 2007 },
  { title: "Süt", year: 2008 },
  { title: "Bal", year: 2010 },
  { title: "Mustang", year: 2015 },
  { title: "Sivas", year: 2014 },
  { title: "Abluka", year: 2015 },
  { title: "Kelebekler", year: 2018 },
  { title: "Zenne", year: 2011 },
  { title: "Siccin", year: 2014 },
  { title: "Dabbe", year: 2006 },
  { title: "Kutsal Damacana", year: 2007 },
  { title: "Osmanlı Cumhuriyeti", year: 2008 },
  { title: "Babam ve Oğlum", year: 2005 },
  // --- 2. genişletme: klasikler ---
  { title: "Fargo", year: 1996 },
  { title: "The Usual Suspects", year: 1995 },
  { title: "L.A. Confidential", year: 1997 },
  { title: "Chinatown", year: 1974 },
  { title: "Rear Window", year: 1954 },
  { title: "Psycho", year: 1960 },
  { title: "Vertigo", year: 1958 },
  { title: "North by Northwest", year: 1959 },
  { title: "Casablanca", year: 1942 },
  { title: "Sunset Boulevard", year: 1950 },
  { title: "Some Like It Hot", year: 1959 },
  { title: "Singin' in the Rain", year: 1952 },
  { title: "The Wizard of Oz", year: 1939 },
  { title: "Citizen Kane", year: 1941 },
  { title: "To Kill a Mockingbird", year: 1962 },
  { title: "Lawrence of Arabia", year: 1962 },
  { title: "The Bridge on the River Kwai", year: 1957 },
  { title: "The Sound of Music", year: 1965 },
  { title: "Mary Poppins", year: 1964 },
  { title: "Grease", year: 1978 },
  { title: "Dirty Dancing", year: 1987 },
  { title: "Ghost", year: 1990 },
  { title: "Pretty Woman", year: 1990 },
  { title: "When Harry Met Sally...", year: 1989 },
  { title: "Notting Hill", year: 1999 },
  { title: "Love Actually", year: 2003 },
  { title: "The Devil Wears Prada", year: 2006 },
  { title: "Mean Girls", year: 2004 },
  { title: "Legally Blonde", year: 2001 },
  { title: "The Breakfast Club", year: 1985 },
  { title: "Ferris Bueller's Day Off", year: 1986 },
  { title: "Groundhog Day", year: 1993 },
  { title: "Big", year: 1988 },
  { title: "Mrs. Doubtfire", year: 1993 },
  { title: "Jumanji", year: 1995 },
  { title: "The Mask", year: 1994 },
  { title: "Dumb and Dumber", year: 1994 },
  { title: "Bruce Almighty", year: 2003 },
  // --- 2. genişletme: aksiyon / gerilim ---
  { title: "Men in Black", year: 1997 },
  { title: "Independence Day", year: 1996 },
  { title: "Armageddon", year: 1998 },
  { title: "The Fifth Element", year: 1997 },
  { title: "Total Recall", year: 1990 },
  { title: "RoboCop", year: 1987 },
  { title: "Predator", year: 1987 },
  { title: "The Terminator", year: 1984 },
  { title: "Aliens", year: 1986 },
  { title: "Die Hard", year: 1988 },
  { title: "Lethal Weapon", year: 1987 },
  { title: "Speed", year: 1994 },
  { title: "The Rock", year: 1996 },
  { title: "Face/Off", year: 1997 },
  { title: "Mission: Impossible", year: 1996 },
  { title: "The Bourne Identity", year: 2002 },
  { title: "Bad Boys", year: 1995 },
  { title: "Rush Hour", year: 1998 },
  { title: "Ocean's Eleven", year: 2001 },
  { title: "The Italian Job", year: 2003 },
  { title: "Now You See Me", year: 2013 },
  { title: "Knives Out", year: 2019 },
  { title: "Sherlock Holmes", year: 2009 },
  { title: "National Treasure", year: 2004 },
  { title: "The Da Vinci Code", year: 2006 },
  { title: "I Am Legend", year: 2007 },
  { title: "World War Z", year: 2013 },
  { title: "28 Days Later", year: 2002 },
  { title: "Shaun of the Dead", year: 2004 },
  { title: "Zombieland", year: 2009 },
  // --- 2. genişletme: korku ---
  { title: "The Conjuring", year: 2013 },
  { title: "Insidious", year: 2010 },
  { title: "Sinister", year: 2012 },
  { title: "The Exorcist", year: 1973 },
  { title: "Poltergeist", year: 1982 },
  { title: "The Ring", year: 2002 },
  { title: "Saw", year: 2004 },
  { title: "Final Destination", year: 2000 },
  { title: "Scream", year: 1996 },
  { title: "Halloween", year: 1978 },
  { title: "A Nightmare on Elm Street", year: 1984 },
  { title: "It", year: 2017 },
  { title: "The Witch", year: 2015 },
  { title: "Midsommar", year: 2019 },
  { title: "Us", year: 2019 },
  { title: "The Sixth Sense", year: 1999 },
  { title: "Split", year: 2016 },
  // --- 2. genişletme: modern drama / bilimkurgu ---
  { title: "Black Swan", year: 2010 },
  { title: "Nightcrawler", year: 2014 },
  { title: "Drive", year: 2011 },
  { title: "Baby Driver", year: 2017 },
  { title: "Sicario", year: 2015 },
  { title: "Kingsman: The Secret Service", year: 2014 },
  { title: "Scott Pilgrim vs. the World", year: 2010 },
  { title: "Edge of Tomorrow", year: 2014 },
  { title: "Looper", year: 2012 },
  { title: "Source Code", year: 2011 },
  { title: "Ex Machina", year: 2014 },
  { title: "Her", year: 2013 },
  { title: "Moon", year: 2009 },
  { title: "Annihilation", year: 2018 },
  { title: "Tenet", year: 2020 },
  { title: "Dunkirk", year: 2017 },
  { title: "1917", year: 2019 },
  { title: "Hacksaw Ridge", year: 2016 },
  { title: "Fury", year: 2014 },
  { title: "The Hurt Locker", year: 2008 },
  { title: "Black Hawk Down", year: 2001 },
  { title: "The Pianist", year: 2002 },
  { title: "The Boy in the Striped Pyjamas", year: 2008 },
  { title: "Dallas Buyers Club", year: 2013 },
  { title: "The Theory of Everything", year: 2014 },
  { title: "The Imitation Game", year: 2014 },
  { title: "A Beautiful Mind", year: 2001 },
  { title: "Bohemian Rhapsody", year: 2018 },
  { title: "Rocketman", year: 2019 },
  { title: "Walk the Line", year: 2005 },
  { title: "8 Mile", year: 2002 },
  { title: "The Greatest Showman", year: 2017 },
  { title: "Moulin Rouge!", year: 2001 },
  { title: "A Star Is Born", year: 2018 },
  { title: "School of Rock", year: 2003 },
  { title: "Into the Wild", year: 2007 },
  { title: "127 Hours", year: 2010 },
  { title: "The Martian", year: 2015 },
  { title: "Apollo 13", year: 1995 },
  { title: "Hidden Figures", year: 2016 },
  { title: "Contact", year: 1997 },
  { title: "Close Encounters of the Third Kind", year: 1977 },
  // --- 2. genişletme: süper kahraman / seri ---
  { title: "Batman Begins", year: 2005 },
  { title: "The Dark Knight Rises", year: 2012 },
  { title: "Spider-Man", year: 2002 },
  { title: "Spider-Man: No Way Home", year: 2021 },
  { title: "Doctor Strange", year: 2016 },
  { title: "Thor: Ragnarok", year: 2017 },
  { title: "Captain America: The Winter Soldier", year: 2014 },
  { title: "X-Men", year: 2000 },
  { title: "Wonder Woman", year: 2017 },
  { title: "Watchmen", year: 2009 },
  { title: "V for Vendetta", year: 2005 },
  { title: "Sin City", year: 2005 },
  { title: "300", year: 2006 },
  { title: "Troy", year: 2004 },
  { title: "Kingdom of Heaven", year: 2005 },
  { title: "The Last Samurai", year: 2003 },
  { title: "Dances with Wolves", year: 1990 },
  { title: "Star Wars: The Force Awakens", year: 2015 },
  { title: "Rogue One: A Star Wars Story", year: 2016 },
  { title: "Dune: Part Two", year: 2024 },
  { title: "Avatar: The Way of Water", year: 2022 },
  { title: "Pacific Rim", year: 2013 },
  { title: "Ready Player One", year: 2018 },
  { title: "The Hunger Games", year: 2012 },
  { title: "The Maze Runner", year: 2014 },
  { title: "Harry Potter and the Deathly Hallows: Part 2", year: 2011 },
  { title: "Fantastic Beasts and Where to Find Them", year: 2016 },
  { title: "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe", year: 2005 },
  { title: "Charlie and the Chocolate Factory", year: 2005 },
  { title: "The Princess Bride", year: 1987 },
  { title: "Pan's Labyrinth", year: 2006 },
  { title: "The Shape of Water", year: 2017 },
  { title: "Edward Scissorhands", year: 1990 },
  { title: "Beetlejuice", year: 1988 },
  { title: "The Nightmare Before Christmas", year: 1993 },
  { title: "Coraline", year: 2009 },
  // --- 2. genişletme: animasyon ---
  { title: "Ice Age", year: 2002 },
  { title: "Madagascar", year: 2005 },
  { title: "Rio", year: 2011 },
  { title: "Sing", year: 2016 },
  { title: "Minions", year: 2015 },
  { title: "Despicable Me", year: 2010 },
  { title: "Hotel Transylvania", year: 2012 },
  { title: "Megamind", year: 2010 },
  { title: "A Bug's Life", year: 1998 },
  { title: "Cars", year: 2006 },
  { title: "Brave", year: 2012 },
  { title: "Moana", year: 2016 },
  { title: "Tangled", year: 2010 },
  { title: "The Little Mermaid", year: 1989 },
  { title: "Beauty and the Beast", year: 1991 },
  { title: "Aladdin", year: 1992 },
  { title: "Mulan", year: 1998 },
  { title: "Hercules", year: 1997 },
  { title: "Tarzan", year: 1999 },
  { title: "Lilo & Stitch", year: 2002 },
  { title: "Big Hero 6", year: 2014 },
  { title: "Wreck-It Ralph", year: 2012 },
  { title: "Encanto", year: 2021 },
  { title: "Luca", year: 2021 },
  { title: "Soul", year: 2020 },
  { title: "Chicken Run", year: 2000 },
];

interface TmdbSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  popularity?: number;
}

interface TmdbBackdrop {
  file_path: string;
  /** null ise görselde metin yok (saf sahne karesi) — bkz. dosya başındaki not. */
  iso_639_1: string | null;
  vote_average?: number;
}

export interface KareselMovie {
  tmdbId: number;
  /** TMDB'nin Türkçe başlığı — cevap gösteriminde ve tahmin listesinde kullanılıyor. */
  title: string;
  originalTitle: string;
  year: string | null;
  /** Zorluk sırasına dizilmiş kare yolları (en bilinmedik -> en tanıdık). */
  frames: string[];
}

async function searchMovie({ title, year }: MovieQuery): Promise<TmdbSearchResult | null> {
  const params = new URLSearchParams({ api_key: API_KEY, query: title, language: "tr-TR" });
  // Yıl parametresinin adı da türe göre değişiyor.
  if (year) params.set(DIZI_MODU ? "first_air_date_year" : "primary_release_year", String(year));
  const res = await fetch(`https://api.themoviedb.org/3/search/${TUR}?${params.toString()}`);
  if (!res.ok) throw new Error(`TMDB arama başarısız (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  const ilk = data.results?.[0];
  return ilk ? normalizeSonuc(ilk) : null;
}

/** TMDB'nin TV kayıtları film alanlarının aynısını FARKLI ADLA taşıyor
 *  (title->name, original_title->original_name, release_date->first_air_date).
 *  Tek yerde normalize ediliyor ki aşağıdaki akış iki tür için de değişmesin. */
function normalizeSonuc(ham: Record<string, unknown>): TmdbSearchResult {
  return {
    id: ham.id as number,
    title: (ham.title ?? ham.name) as string,
    original_title: (ham.original_title ?? ham.original_name) as string,
    release_date: (ham.release_date ?? ham.first_air_date) as string | undefined,
  };
}

/**
 * YEDEK KAYNAK — dizi bölümlerinin sahne kareleri.
 *
 * Türk dizilerinin çoğu dizi düzeyinde yeterli yazısız kare bulunmadığı için
 * havuza giremiyordu: 72 başlığın 32'si elendi, Kurtlar Vadisi'nde 1, Ezel'de 4
 * kare vardı (ölçüldü). Aynı dizilerin BÖLÜM kareleri ise bol: Kurtlar Vadisi'nin
 * 1. sezonunda 9, Ezel'de 33 kare var. Bölüm kareleri zaten saf sahne görüntüsü,
 * yani promosyon görsellerindeki "üzerinde dizi adı yazıyor" sorunu da yok.
 *
 * SPOILER: erken sezonlardan başlanıyor ve gerekli sayıya ulaşınca duruluyor —
 * son sezonun karesi finali ele verebilir.
 *
 * SIRALAMA: dizi düzeyindeki kareler TMDB'de oylamaya göre sıralı geldiği için
 * "en bilinmedikten en tanıdığa" dizilebiliyordu; bölüm karelerinde böyle bir
 * sinyal YOK (oylar hep 0). Burada sıra bölüm sırası oluyor, yani zorluk akışı
 * garanti değil. Diziyi havuzun dışında bırakmaktansa kabul edildi.
 */
async function fetchEpisodeStills(tvId: number, gereken: number): Promise<TmdbBackdrop[]> {
  const detay = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${API_KEY}`);
  if (!detay.ok) return [];
  const data = (await detay.json()) as { seasons?: { season_number: number }[] };
  const sezonlar = (data.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  const kareler: TmdbBackdrop[] = [];
  for (const sezon of sezonlar) {
    if (kareler.length >= gereken * 2) break; // eleme payı bırak
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${sezon.season_number}?api_key=${API_KEY}`
    );
    if (!res.ok) continue;
    const sd = (await res.json()) as { episodes?: { still_path?: string | null }[] };
    for (const bolum of sd.episodes ?? []) {
      if (bolum.still_path) kareler.push({ file_path: bolum.still_path, iso_639_1: null });
    }
  }
  return kareler;
}

async function fetchTextlessBackdrops(movieId: number): Promise<TmdbBackdrop[]> {
  // language parametresi YOK — verilirse TMDB sadece o dilin (metinli) görsellerini
  // döndürüyor, bize ise dilsiz/metinsiz olanlar lazım.
  const res = await fetch(`https://api.themoviedb.org/3/${TUR}/${movieId}/images?api_key=${API_KEY}`);
  if (!res.ok) throw new Error(`TMDB görseller başarısız (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { backdrops?: TmdbBackdrop[] };
  return (data.backdrops ?? []).filter((b) => b.iso_639_1 === null);
}

/**
 * Karenin 8x8 gri tonlu "parmak izi". İki karenin ortalama piksel farkı küçükse
 * aynı sahnenin iki anı demektir.
 *
 * ffmpeg ile üretiliyor — projede zaten ses kesmek için kurulu, ayrıca görüntü
 * işleme bağımlılığı (sharp vb.) eklemeye değmezdi.
 */
async function parmakIzi(filePath: string): Promise<number[] | null> {
  const gecici = mkdtempSync(path.join(tmpdir(), "karesel-"));
  try {
    const jpg = path.join(gecici, "k.jpg");
    const pgm = path.join(gecici, "k.pgm");
    const res = await fetch(`https://image.tmdb.org/t/p/w185${filePath}`);
    if (!res.ok) return null;
    writeFileSync(jpg, Buffer.from(await res.arrayBuffer()));
    execFileSync(ffmpegYolu, ["-y", "-loglevel", "error", "-i", jpg, "-vf", "scale=8:8,format=gray", pgm]);
    const buf = readFileSync(pgm);
    return [...buf.subarray(buf.length - 64)];
  } catch {
    return null;
  } finally {
    rmSync(gecici, { recursive: true, force: true });
  }
}

function fark(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / 64;
}

/**
 * Karenin ÜST ve ALT şeridinin parmak izi — kalıcı logo/bant aramak için.
 *
 * Neden gerekli: bazı dizilerin bölüm karelerinde köşeye dizinin LOGOSU basılı
 * ("kardeş payı · BÖLÜM 22", "HAYAT BİLGİSİ · 19. BÖLÜM"). Bu kareler benzerlik
 * süzgecine takılmıyor çünkü ARKADAKİ SAHNE her birinde farklı — yalnızca bandın
 * kendisi sabit. Ama dizinin adı karenin üstünde yazdığı için bulmacanın cevabını
 * doğrudan veriyorlar (gözle görüldü). Bandı yakalamanın yolu: şeridi ayrı
 * ölçmek ve şerit neredeyse hiç değişmiyorken sahnenin değiştiğini görmek.
 */
async function seritIzi(filePath: string): Promise<{ ust: number[]; alt: number[] } | null> {
  const gecici = mkdtempSync(path.join(tmpdir(), "karesel-s-"));
  try {
    const jpg = path.join(gecici, "k.jpg");
    const res = await fetch(`https://image.tmdb.org/t/p/w185${filePath}`);
    if (!res.ok) return null;
    writeFileSync(jpg, Buffer.from(await res.arrayBuffer()));
    const oku = (kirp: string) => {
      const pgm = path.join(gecici, `${kirp.replace(/[^a-z0-9]/gi, "")}.pgm`);
      execFileSync(ffmpegYolu, [
        "-y", "-loglevel", "error", "-i", jpg,
        "-vf", `crop=${kirp},scale=8:4,format=gray`, pgm,
      ]);
      const buf = readFileSync(pgm);
      return [...buf.subarray(buf.length - 32)];
    };
    return { ust: oku("iw:ih/4:0:0"), alt: oku("iw:ih/4:0:ih*3/4") };
  } catch {
    return null;
  } finally {
    rmSync(gecici, { recursive: true, force: true });
  }
}

/** Şerit farklarının ortancası bu değerin altındaysa orada sabit bir bant var. */
const SERIT_ESIGI = 6;

/**
 * Seçilmiş karelerde üst ya da alt şerit neredeyse hiç değişmiyorsa `true`.
 * Sahnelerin kendisi farklı olduğu halde bir şerit sabitse, orada basılı bir
 * logo/kuşak var demektir.
 */
async function kaliciBantVar(yollar: string[]): Promise<boolean> {
  const izler = (await Promise.all(yollar.map(seritIzi))).filter(Boolean) as {
    ust: number[];
    alt: number[];
  }[];
  if (izler.length < 3) return false;

  for (const yer of ["ust", "alt"] as const) {
    const farklar: number[] = [];
    for (let i = 0; i < izler.length; i++) {
      for (let j = i + 1; j < izler.length; j++) {
        const a = izler[i][yer];
        const b = izler[j][yer];
        farklar.push(a.reduce((s, v, k) => s + Math.abs(v - b[k]), 0) / a.length);
      }
    }
    farklar.sort((x, y) => x - y);
    if (farklar[Math.floor(farklar.length / 2)] < SERIT_ESIGI) return true;
  }
  return false;
}

/**
 * Aynı sahneden iki kare seçilmesin diye eşik. Ölçüldü ("Bir Zamanlar
 * Anadolu'da"): aynı sahnenin iki anı 27,2 fark veriyordu, gerçekten farklı
 * sahneler 45 ve üzeri. 35 ikisini ayırıyor.
 */
const BENZERLIK_ESIGI = 35;

/**
 * Yazısız kareler arasından FRAME_COUNT tanesini zorluk sırasına dizer.
 * TMDB listesi "en ikonik önce" sıralı olduğu için liste ters çevriliyor:
 * ilk kare en bilinmedik, son kare en tanıdık.
 *
 * ESKİDEN eşit aralıklarla örnekleniyordu ve bu yetmiyordu: aynı sahnenin
 * kareleri TMDB listesinde YAN YANA duruyor, örnekleme ikisini birden
 * seçebiliyordu. Kullanıcı bildirdi — bir günde 5 karenin 3'ü aynı sahneydi ve
 * oyun 6 hak yerine fiilen 3-4 hak sunuyordu. Artık her aday, seçilmiş TÜM
 * karelerle karşılaştırılıyor.
 */
async function pickFrames(backdrops: TmdbBackdrop[], kati = false): Promise<string[]> {
  const obscureFirst = [...backdrops].reverse();

  const adaylar: { yol: string; iz: number[] | null }[] = [];
  for (const b of obscureFirst) {
    adaylar.push({ yol: b.file_path, iz: await parmakIzi(b.file_path) });
  }

  const sec = (esik: number): string[] => {
    const secilen: { yol: string; iz: number[] | null }[] = [];
    for (const a of adaylar) {
      if (secilen.length >= FRAME_COUNT) break;
      const cakisiyor = a.iz
        ? secilen.some((s) => s.iz && fark(a.iz!, s.iz) < esik)
        : false; // parmak izi alınamadıysa eleme, kare kaybetmektense riski al
      if (!cakisiyor) secilen.push(a);
    }
    return secilen.map((s) => s.yol);
  };

  /* Eşik gevşetiliyor: bazı filmlerde yeterince farklı 6 kare yok. Eksik
     kareyle bırakmaktansa biraz benzer kare koymak iyi — oyun 6 kare bekliyor. */
  /* KATI kipte de 15'e kadar gevşetiliyor, çünkü 25'te durmak İYİ dizileri de
     eliyordu: Bir Başkadır'ın 8 bölümlük 6 karesi gerçek ve birbirinden farklı
     sahnelerdi ama 25 eşiğini geçemedi. Ayırt edici olan asıl fark şu — jenerik
     kartları birbirinin NEREDEYSE AYNISI (sadece bölüm numarası değişiyor), yani
     15'i de geçemiyorlar. Kritik olan, katı kipte sıfıra inip "ne bulursan al"
     durumuna DÜŞMEMEK. */
  for (const esik of kati ? [BENZERLIK_ESIGI, 25, 15] : [BENZERLIK_ESIGI, 25, 15, 0]) {
    const s = sec(esik);
    if (s.length === FRAME_COUNT) return s;
  }
  /* KATI kipte pes ediliyor. Bölüm karelerinde gevşetme TEHLİKELİ: bazı Türk
     dizilerinin "bölüm karesi" diye kayıtlı görseli aslında üzerinde dizi adının
     yazdığı jenerik kartı ve sadece bölüm numarası değişiyor. Eşik sıfıra kadar
     gevşetilince Kurtlar Vadisi'nin altı karesi de "KURTLAR VADİSİ PUSU 41.BÖLÜM"
     tabelası olarak seçildi — cevabı doğrudan ele veriyordu (gözle görüldü).
     Yeterince farklı 6 kare çıkmıyorsa dizi havuza HİÇ alınmıyor. */
  if (kati) return [];
  return adaylar.slice(0, FRAME_COUNT).map((a) => a.yol);
}

async function main() {
  /* TMDB bu makinede DNS ile engelli (adres 127.0.0.1 e cozuluyor). Sifreli
     DNS ile gercek adres bulunuyor; ayrintili gerekce dns-doh.ts icinde. */
  await dnsYamasiKur(["api.themoviedb.org", "image.tmdb.org"]);

  const movies: KareselMovie[] = [];
  const liste = DIZI_MODU ? SERIES_TITLES : MOVIE_TITLES;

  for (const query of liste) {
    /* Başlık başına hata toleransı ŞART. Yoksa tek bir ağ hıçkırığı tüm koşuyu
       öldürüyor ve dosya hiç yazılmadığı için o ana kadarki işin TAMAMI çöpe
       gidiyor — bu betikte gerçekten yaşandı (TMDB'ye giden bir istek bir anlık
       DNS sorunuyla ECONNREFUSED aldı, 175 başlığın 165'i işlenmişti ve hepsi
       kayboldu). Şarkısal'ın toplu indirme betiğinde aynı ders alınmıştı. */
    try {
      await isle(query, movies);
    } catch (hata) {
      console.log(`[hata] "${query.title}" atlandı: ${(hata as Error).message}`);
    }
  }

  /* VERİ EZME KORUMASI. Betik sonucu dosyaya HER ZAMAN yazıyordu; TMDB'ye erişim
     kesildiği bir koşuda 175 başlığın hepsi hata verdi ve 143 dizilik dosya BOŞ
     diziyle EZİLDİ (yedekten dönüldü). Toplu bir kaynak hatası, elde olan veriyi
     kaybetmenin gerekçesi olamaz: mevcut dosyanın belirgin altına düşen bir sonuç
     yazılmıyor ve çıkış kodu hata veriyor. */
  const oncekiSayi = existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, "utf8")) as unknown[]).length
    : 0;
  if (movies.length < oncekiSayi * 0.8) {
    console.error(
      `\n[İPTAL] Sonuç ${movies.length} kayıt, mevcut dosyada ${oncekiSayi} var — dosya EZİLMEDİ. ` +
        `Muhtemelen kaynağa erişilemedi; bağlantıyı kontrol edip tekrar çalıştır.`
    );
    process.exit(1);
  }

  writeFileSync(outPath, `${JSON.stringify(movies, null, 2)}\n`);
  console.log(`\n[tamamlandı] ${movies.length} ${TUR_ADI} yazıldı: ${path.relative(rootDir, outPath)}`);
}

async function isle(query: MovieQuery, movies: KareselMovie[]) {
  {
    const found = await searchMovie(query);
    if (!found) {
      console.log(`[atlandı] "${query.title}" TMDB'de bulunamadı.`);
      return;
    }

    let backdrops = await fetchTextlessBackdrops(found.id);
    let kaynak = "dizi karesi";
    // Dizilerde bölüm kareleri yedek kaynak — gerekçesi fetchEpisodeStills'te.
    if (DIZI_MODU && backdrops.length < MIN_TEXTLESS_BACKDROPS) {
      const stills = await fetchEpisodeStills(found.id, MIN_TEXTLESS_BACKDROPS);
      if (stills.length > backdrops.length) {
        backdrops = stills;
        kaynak = "bölüm karesi";
      }
    }
    if (backdrops.length < MIN_TEXTLESS_BACKDROPS) {
      console.log(`[atlandı] "${found.title}" için yazısız kare yetersiz (${backdrops.length}/${MIN_TEXTLESS_BACKDROPS}).`);
      return;
    }

    // Bölüm karelerinde KATI eleme — gerekçesi pickFrames içinde yazılı.
    const frames = await pickFrames(backdrops, kaynak === "bölüm karesi");
    if (frames.length < FRAME_COUNT) {
      console.log(`[atlandı] "${found.title}" bölüm kareleri birbirinin aynı (jenerik kartı olabilir).`);
      return;
    }
    if (kaynak === "bölüm karesi" && (await kaliciBantVar(frames))) {
      console.log(`[atlandı] "${found.title}" karelerinde sabit bant var (dizi logosu basılı olabilir).`);
      return;
    }

    movies.push({
      tmdbId: found.id,
      title: found.title,
      originalTitle: found.original_title,
      year: found.release_date ? found.release_date.slice(0, 4) : null,
      frames,
    });
    console.log(`${found.title} (${found.release_date?.slice(0, 4) ?? "?"}) -> ${backdrops.length} ${kaynak}, ${FRAME_COUNT} seçildi`);
  }
}

main();

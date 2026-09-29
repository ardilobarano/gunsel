import type { LetterStatus } from "@/lib/kelimesel";
import type { MovieGuessEntry } from "@/lib/karesel";

export type GameId = "kelimesel" | "sarkisal" | "harfBahcesi" | "dahaAzCok" | "karesel" | "haritasal" | "baglamsal" | "renksel";

export type GameStatus = "NOT_STARTED" | "PLAYING" | "WON" | "LOST";

export interface GameMeta {
  id: GameId;
  name: string;
  href: string;
  description: string;
  accent: "green" | "yellow" | "red";
}

export interface SongGuessEntry {
  skipped: boolean;
  title?: string;
  artist?: string;
  spotifyTrackId?: string;
  /** Şarkı yanlış ama sanatçı doğruysa true — ipucu olarak sarı gösterilir. */
  artistMatch?: boolean;
}

/** Özel Kelimesel: bir kelimenin tamamlanmış (WON/LOST) hâlinin özeti — geçmişte
 * gezinirken (Stepper ile geri gidince) o kelimenin tahtasını salt-okunur göstermek için. */
export interface CustomWordRecord {
  guesses: string[];
  evaluations: LetterStatus[][];
  status: "WON" | "LOST";
  revealedWord: string | null;
}

export interface GameStat {
  status: GameStatus;
  attempts: number;
  /**
   * Sunucunun imzaladığı SON attemptsToken.
   *
   * Yarım kalan oyuna devam etmenin tek meşru yolu bu. Eskiden deneme sayısı
   * /challenge'a parametre olarak bildiriliyordu; bu, cevabı iki istekte sızdıran
   * bir açıktı (attempts=5 + tek tahmin -> sunucu son deneme sanıp cevabı açıyordu).
   * Artık /challenge her zaman sıfırdan token verir; devam ederken buradaki token
   * kullanılır. HMAC'li olduğu için uydurulamaz.
   */
  attemptsToken?: string;
  guesses?: string[];
  /** Oyun bitince (WON/LOST) sunucudan gelen cevap — kendi tarayıcısında zaten görülmüş, tekrar gizlenmesine gerek yok. */
  revealedAnswer?: { title: string; artist: string };
  /** Kelimesel: guesses ile paralel, her tahminin harf-bazlı geri bildirimi. */
  evaluations?: LetterStatus[][];
  /** Kelimesel: oyun bitince (WON/LOST) sunucudan gelen kelime. */
  revealedWord?: string;
  /** Haritasal: her tahminin mesafe/yön/yakınlık sonucu. */
  haritasalGuesses?: {
    label: string;
    /** HEAT_LEVELS indeksi; kilometre saklanmıyor (bkz. lib/haritasal.ts). */
    heat: number;
    bearing: number | null;
    correct: boolean;
  }[];
  /** Haritasal: oyun bitince açığa çıkan bölge. Dünya sekmesinde bayrak, İller
   *  sekmesinde plaka gelir — ikisi de opsiyonel. */
  revealedCountry?: { label: string; flag?: string; plaka?: number };
  /** Renksel: her turun tahmini, doğrusu ve puanı. */
  renkselSonuclar?: { tahmin: string; dogru: string; puan: number }[];
  /** Bağlamsal: çözülmüş gruplar (ad, zorluk, kelimeler). */
  baglamsalSolved?: { name: string; level: number; words: string[] }[];
  /** Bağlamsal: yapılan hata sayısı. */
  baglamsalMistakes?: number;
  /** Bağlamsal: kaybedince açığa çıkan tüm gruplar. */
  baglamsalAllGroups?: { name: string; level: number; words: string[] }[];
  /** Şarkısal: her tahminin (Spotify aramasından seçilen) başlık/sanatçı bilgisi. */
  songGuesses?: SongGuessEntry[];
  /** Özel Kelimesel: hangi kelimede olunduğu (0-index) — guesses/evaluations sadece
   * bu kelimeye ait, kelime değişince sıfırlanır. */
  customWordIndex?: number;
  /** Özel Kelimesel: Time Limit ayarı için sabit başlangıç damgası (epoch saniye). */
  customStartedAt?: number;
  /** Özel Kelimesel: kaybedince (deneme/süre bitince) açığa çıkan, henüz çözülmemiş kelimeler. */
  customRevealedWords?: string[];
  /** Özel Kelimesel: tamamlanmış (WON/LOST) kelimelerin özeti — index = kelime sırası.
   * Kelimeler arası gezinme (Stepper) geçmiş kelimeleri salt-okunur göstermek için bunu kullanır. */
  customWordRecords?: CustomWordRecord[];
  /** Daha Az/Daha Çok: o ana kadar açığa çıkan öğeler (değerleriyle), ilk öğe referans. */
  dahaAzCokRevealedItems?: { id: string; label: string; value: number; unit: string }[];
  /** Daha Az/Daha Çok: kaçıncı karşılaştırmada olunduğu (0-5). */
  dahaAzCokStepIndex?: number;
  /** Daha Az/Daha Çok: o ana kadarki doğru tahmin sayısı — yanlış tahmin turu bitirmiyor. */
  dahaAzCokCorrectCount?: number;
  /** Daha Az/Daha Çok: her turun doğru/yanlış geçmişi (ilerleme noktalarını renklendirmek için). */
  dahaAzCokRoundResults?: boolean[];
  /** Karesel: her tahminin (TMDB aramasından seçilen) film bilgisi. */
  movieGuesses?: MovieGuessEntry[];
  /** Karesel: o ana kadar açılmış kare yolları — sunucu sadece açılanları gönderiyor,
   * sayfa yenilenince tekrar istek atmadan doğru kareleri göstermek için saklanıyor. */
  revealedFrames?: string[];
  /** Karesel: oyun bitince (WON/LOST) sunucudan gelen film. */
  revealedMovie?: { title: string; originalTitle: string; year: string | null };
}

/** Anahtar bir GameId veya "kelimesel-5" gibi harf uzunluğuna göre birleşik bir kimlik olabilir. */
export type DayStats = Record<string, GameStat>;

export type BulmacaStats = Record<string, DayStats>;

export interface SongPlayback {
  /** Tahmin doğrulaması bu ID üzerinden yapılır — Spotify arama sonucuyla birebir eşleşir. */
  spotifyTrackId: string;
}

/**
 * songId -> oynatma bilgisi. Sadece burada listelenen şarkılar günün cevabı
 * için otomatik seçilebilir (bkz. sarkisal.server.ts'teki getDailyChallenge) —
 * songs.json'daki katalogun tamamı değil, sadece ses kaynağı atanmış olanlar.
 * Gerçek ses dosyası obfuscated isimle public/audio-secure/ altında durur
 * (getObfuscatedAudioPathForSong ile songId'den türetilir).
 */
export const SONG_PLAYBACK: Record<string, SongPlayback> = {  "pop-01": { spotifyTrackId: "6vEL7E8TGzrxuxbrgdlkLL" }, // Tarkan - Şımarık  "pop-02": { spotifyTrackId: "5D1Btx3N9b6saYjTQDjT1j" }, // Sezen Aksu - Kaçın Kurası  "pop-03": { spotifyTrackId: "4o4kbDP7DMVFPwAf5D5bj9" }, // Simge - Aşkın Olayım  "pop-04": { spotifyTrackId: "4zii0deGpRgmpiv1w4W6DM" }, // Mabel Matiz - Sarmaşık  "pop-05": { spotifyTrackId: "7Bw8RkiCXAnXITIijtlizz" }, // Hadise - Düm Tek Tek  "pop-06": { spotifyTrackId: "2F2Mve0qkQSrKY5OOnsHdz" }, // Gülşen - Bangır Bangır  "rap-01": { spotifyTrackId: "1JvUmKSl9Mg6mQnmbjLYyz" }, // Ceza - Suspus  "rap-02": { spotifyTrackId: "6uuQZFYzeUf1NR5tucdjj5" }, // Sagopa Kajmer - Galiba - Orijinal Rap Versiyon  "rap-03": { spotifyTrackId: "3n0VsLOc3n9wU8KNJUU0Ws" }, // Norm Ender - Parla - 100. Yıl Marşı  "rap-04": { spotifyTrackId: "5vJTUmbKFvFMcirWag0XJD" }, // Ezhel - Felaket  "rap-05": { spotifyTrackId: "09XOVDSIbBxBf6Kr1vGnHf" }, // Ceza - Neyim Var Ki (feat. Sagopa K)  "rap-06": { spotifyTrackId: "4a1WLOoydq7u011UG9jjC9" }, // UZI - Krvn
  "pop-07": { spotifyTrackId: "3ajYmPDtB3P7JTPQ64Dr7P" }, // Tarkan - Kuzu Kuzu
  "pop-08": { spotifyTrackId: "5voZKuwzMtKxp4Vkgc7kdY" }, // Sıla - Vaziyetler
  "pop-09": { spotifyTrackId: "1jH3jM3CqPmZcX7gzVPLHb" }, // Kenan Doğulu - Çakkıdı
  "pop-10": { spotifyTrackId: "5ExsZq3AmQGxavPJOzf0M5" }, // Aleyna Tilki - Sen Olsan Bari
  "rap-07": { spotifyTrackId: "0R0o8uOkDz40XsR6uwThfQ" }, // Ezhel - Geceler
  "rap-08": { spotifyTrackId: "40Fr7DB1j6RB2DqygQI4LI" }, // Ceza - Holocaust
  "rap-09": { spotifyTrackId: "75UeVjsdMh9mfkmSeNUxPX" }, // Khontkar - KHK
  "rap-10": { spotifyTrackId: "3e0XM5ARlFVbWLfdR7zZvp" }, // Motive - YIN YANG
  "rock-01": { spotifyTrackId: "4KHLOlytj8vnlUl0nKEcmn" }, // Barış Manço - Gülpembe
  "rock-02": { spotifyTrackId: "1FWtprHStw6VvFqFXDmLT9" }, // Cem Karaca - Resimdeki Gözyaşları
  "rock-03": { spotifyTrackId: "4uqlFpMPTKO6uAsX6qvK0l" }, // Duman - Her Şeyi Yak
  "rock-04": { spotifyTrackId: "4PzGwrM4NGUuCBR5WTFCth" }, // Şebnem Ferah - Sil Baştan
  "rock-05": { spotifyTrackId: "0vWr52Zx9XHl3qOVefySzY" }, // Teoman - Paramparça
  "rock-06": { spotifyTrackId: "3QYBnMvh7xNd6ECUDQgczW" }, // MFÖ - Ali Desidero
  "rock-07": { spotifyTrackId: "397A58sUsAVNZlvriDmfl9" }, // maNga - Bir Kadın Çizeceksin
  "rock-08": { spotifyTrackId: "7aBKX9bD1PYtDsc8xdrcAA" }, // Athena - Ben Böyleyim
  "rock-09": { spotifyTrackId: "0ByK7TuuNIrsXQQ28tLwWs" }, // Yeni Türkü - Olmasa Mektubun
  "rock-10": { spotifyTrackId: "5W9w0b1Nn20jFnPBdQ5LVH" }, // Kâzım Koyuncu - Ben Seni Sevduğumi
};

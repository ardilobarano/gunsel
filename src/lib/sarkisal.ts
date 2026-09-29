import songsData from "@/data/songs.json";

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
}

/** Spotify canlı aramasından dönen bir sonuç — tahmin olarak seçilebilecek herhangi bir şarkı. */
export interface SpotifyTrackResult {
  id: string;
  title: string;
  artist: string;
}

export interface SongCategory {
  id: string;
  label: string;
}

/** "Tümü" + fotoğraftaki gibi iki tür sekmesi. Yeni bir tür eklemek için burayı ve songs.json'u güncelle. */
export const SONG_CATEGORIES: SongCategory[] = [
  { id: "tumu", label: "Tümü" },
  { id: "pop", label: "Pop" },
  { id: "rap", label: "Rap" },
];

export const MAX_ATTEMPTS = 6;

/** Her adımda dinlenebilecek kümülatif saniye limiti. */
export const STAGE_SECONDS = [0.2, 0.5, 1, 2, 5, 10] as const;

export const MAX_SECONDS = STAGE_SECONDS[STAGE_SECONDS.length - 1];

export const SKIPPED = "SKIPPED";

const songs = songsData as Song[];

export function getSarkisalGameId(categoryId: string): string {
  return `sarkisal-${categoryId}`;
}

export function getSongsForCategory(categoryId: string): Song[] {
  const category = SONG_CATEGORIES.find((c) => c.id === categoryId);
  if (!category || category.id === "tumu") return songs;
  return songs.filter((song) => song.genre === category.label);
}


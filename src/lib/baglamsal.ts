export const GAME_ID = "baglamsal";
export const GROUP_COUNT = 4;
export const GROUP_SIZE = 4;
export const MAX_MISTAKES = 4;

/** Zorluk sırası: 0 en kolay. NYT Connections'ın renk kodu aynı mantıkta. */
export const LEVEL_COLORS = ["#ffd93d", "#9ae66e", "#7cc6fe", "#c39bff"] as const;

export interface SolvedGroup {
  name: string;
  level: number;
  words: string[];
}

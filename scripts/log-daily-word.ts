import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const targetWordsPath = path.join(rootDir, "src", "data", "targetWords.json");
const validWordsPath = path.join(rootDir, "src", "data", "validWords.json");
const overridesPath = path.join(rootDir, "src", "data", "wordOverrides.json");
const usedWordsPath = path.join(rootDir, "src", "data", "usedWords.json");

const LENGTHS = [3, 4, 5, 6, 7, 8];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getDailyWord(
  targetWords: Record<string, string[]>,
  validWords: Record<string, string[]>,
  overrides: Record<string, Record<string, string>>,
  dateKey: string,
  length: number
): string {
  const override = overrides[dateKey]?.[String(length)];
  if (override && (validWords[String(length)] ?? []).includes(override)) {
    return override;
  }

  const pool = targetWords[String(length)] ?? [];
  if (pool.length === 0) return "";
  const index = hashString(`${dateKey}-${length}`) % pool.length;
  return pool[index];
}

/** Sabit UTC+3 (İstanbul, DST yok) — sunucudaki getServerTodayKey ile aynı mantık. */
function getTodayKey(): string {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function main() {
  const dateArg = process.argv[2];
  const dateKey = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) ? dateArg : getTodayKey();

  const targetWords = JSON.parse(readFileSync(targetWordsPath, "utf8")) as Record<string, string[]>;
  const validWords = JSON.parse(readFileSync(validWordsPath, "utf8")) as Record<string, string[]>;
  const overrides = JSON.parse(readFileSync(overridesPath, "utf8")) as Record<string, Record<string, string>>;
  const usedWords = JSON.parse(readFileSync(usedWordsPath, "utf8")) as Record<string, Record<string, string>>;

  if (usedWords[dateKey]) {
    console.log(`[atlandı] ${dateKey} zaten kayıtlı, üzerine yazılmadı:`, usedWords[dateKey]);
    return;
  }

  const dayEntry: Record<string, string> = {};
  for (const length of LENGTHS) {
    dayEntry[String(length)] = getDailyWord(targetWords, validWords, overrides, dateKey, length);
  }
  usedWords[dateKey] = dayEntry;

  const sorted = Object.fromEntries(Object.entries(usedWords).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(usedWordsPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");

  console.log(`[kaydedildi] ${dateKey}:`, dayEntry);
}

main();

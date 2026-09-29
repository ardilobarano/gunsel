const TR_LOCALE = "tr-TR";

export function trLower(value: string): string {
  return value.toLocaleLowerCase(TR_LOCALE);
}

export function trUpper(value: string): string {
  return value.toLocaleUpperCase(TR_LOCALE);
}

/** Bugünün tarihini yerel saate göre YYYY-MM-DD anahtarı olarak döner. */
export function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTR(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat(TR_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

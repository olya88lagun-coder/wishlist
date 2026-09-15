export type Occasion = "birthday" | "new_year" | "other";

export const EVENT_TIME_ZONE = "Europe/Moscow";
const MS_PER_DAY = 86_400_000;
const DAY_FORMS = ["день", "дня", "дней"] as const;
const OCCASION_TITLE: Record<Occasion, string> = { birthday: "ДР", new_year: "Новый год", other: "Праздник" };

export function todayInTimeZone(now: Date, timeZone = EVENT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtcDay(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function daysUntil(eventDate: string | null, now: Date, timeZone = EVENT_TIME_ZONE): number | null {
  if (!eventDate) return null;
  const days = Math.round((toUtcDay(eventDate) - toUtcDay(todayInTimeZone(now, timeZone))) / MS_PER_DAY);
  return days < 0 ? null : days;
}

export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function countdownLabel(occasion: Occasion, days: number): string {
  const title = OCCASION_TITLE[occasion];
  if (days === 0) return `${title} сегодня`;
  if (days === 1 && occasion === "birthday") return `${title} завтра`;
  return `${title} через ${days} ${pluralRu(days, DAY_FORMS)}`;
}

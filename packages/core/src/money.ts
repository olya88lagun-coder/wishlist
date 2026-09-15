export const MAX_PRICE_RUBLES = 10_000_000;
const KOPECKS_PER_RUBLE = 100;
const rublesFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const rublesWithKopecksFormatter = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function parseRublesToKopecks(input: string): number | null {
  const cleaned = input.replace(/[\s  ₽]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const kopecks = Number(whole) * KOPECKS_PER_RUBLE + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(kopecks) || kopecks > MAX_PRICE_RUBLES * KOPECKS_PER_RUBLE) return null;
  return kopecks;
}

export function formatKopecks(kopecks: number): string {
  const rubles = kopecks / KOPECKS_PER_RUBLE;
  const formatter = kopecks % KOPECKS_PER_RUBLE === 0 ? rublesFormatter : rublesWithKopecksFormatter;
  // ru-RU в Node использует U+00A0 как разделитель групп; приводим к нему явно на случай U+202F
  return `${formatter.format(rubles).replace(/ /g, " ")} ₽`;
}

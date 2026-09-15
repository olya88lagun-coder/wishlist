import { MAX_PRICE_RUBLES, parseRublesToKopecks } from "@wishlist/core";

const KOPECKS_PER_RUBLE = 100;

export function toKopecks(value: unknown): number | null {
  let kopecks: number | null = null;
  if (typeof value === "number" && Number.isFinite(value) && value <= MAX_PRICE_RUBLES) {
    kopecks = Math.round(value * KOPECKS_PER_RUBLE);
  } else if (typeof value === "string") {
    kopecks = parseRublesToKopecks(value);
  }
  return kopecks !== null && kopecks > 0 ? kopecks : null;
}

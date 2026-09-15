import type { ParsedProduct, ParseStatus } from "./types";

export const TITLE_MAX = 200; // = ITEM_TITLE_MAX в @wishlist/db
export const DESCRIPTION_MAX = 1000;
const ROUBLE_CODES = new Set(["RUB", "RUR"]);
const STOCK_PREFIX = /^(?:нет\s+)?в\s+наличии\s*:\s*/i;

function first<T>(values: (T | null | undefined)[]): T | null {
  return values.find((value) => value !== null && value !== undefined && value !== "") ?? null;
}

function cleanText(text: string | null, max: number): string | null {
  if (!text) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed === "") return null;
  return collapsed.length > max ? `${collapsed.slice(0, max - 1).trimEnd()}…` : collapsed;
}

function httpUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mergeProduct(pageUrl: string, parts: Partial<ParsedProduct>[]): ParsedProduct {
  const priceKopecks = first(parts.map((p) => p.priceKopecks));
  // валюту берём из того же источника, что и цену, иначе цена в $ могла бы получить чужой «RUB»
  const priceSource = priceKopecks === null ? undefined : parts.find((p) => p.priceKopecks === priceKopecks);
  const currency = priceSource?.currency ?? null;
  const foreign = currency !== null && !ROUBLE_CODES.has(currency.toUpperCase());
  return {
    title: cleanText(first(parts.map((p) => p.title))?.replace(STOCK_PREFIX, "") ?? null, TITLE_MAX),
    description: cleanText(first(parts.map((p) => p.description)), DESCRIPTION_MAX),
    imageUrl: httpUrl(first(parts.map((p) => p.imageUrl)), pageUrl),
    priceKopecks: foreign ? null : priceKopecks,
    currency: foreign ? null : currency,
  };
}

export function statusFor(product: Pick<ParsedProduct, "title" | "priceKopecks">): ParseStatus {
  if (!product.title) return "failed";
  return product.priceKopecks === null ? "partial" : "ok";
}

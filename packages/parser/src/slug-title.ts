import type { StoreId } from "@wishlist/core";

const SLUG_PATTERNS: Partial<Record<StoreId, RegExp>> = {
  ozon: /^\/product\/([a-z0-9-]+?)(?:-\d{5,})?\/?$/i,
  lamoda: /^\/p\/[a-z0-9]+\/([a-z0-9-]+)\/?$/i,
};
const MIN_LETTERS = 3;

export function titleFromUrlSlug(url: string, store: StoreId): string | null {
  const pattern = SLUG_PATTERNS[store];
  if (!pattern) return null;
  const slug = pattern.exec(new URL(url).pathname)?.[1];
  const words = (slug ?? "").split("-").filter((word) => word !== "" && !/^\d+$/.test(word));
  const text = words.join(" ");
  if (text.replace(/[^a-z]/gi, "").length < MIN_LETTERS) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

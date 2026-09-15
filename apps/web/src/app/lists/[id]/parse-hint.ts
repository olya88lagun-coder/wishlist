import { detectStore } from "@wishlist/core";
import type { ItemParseStatus } from "@wishlist/db";

type HintItem = { parseStatus: ItemParseStatus; title: string; priceKopecks: number | null; sourceUrl: string | null };

export function parseHint(item: HintItem): string | null {
  if (item.parseStatus !== "partial" && item.parseStatus !== "failed") return null;
  const store = item.sourceUrl ? detectStore(item.sourceUrl).label : "Магазин";
  const missing = [item.title === "" ? "название" : null, item.priceKopecks === null ? "цену" : null].filter((field) => field !== null);
  if (missing.length === 0) return null;
  if (missing.length === 1 && missing[0] === "цену") return `${store} не отдал цену — впишите её`;
  return `${store} не отдал данные — впишите ${missing.join(" и ")}`;
}

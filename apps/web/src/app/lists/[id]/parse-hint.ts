import { detectStore } from "@wishlist/core";
import type { ItemParseStatus } from "@wishlist/db";

// Короткие ссылки Ozon (/t/…) с сервера не раскрываются — Ozon отвечает 403
const OZON_SHORT_LINK = /^https?:\/\/(?:www\.)?ozon\.ru\/t\//i;

type HintItem = { parseStatus: ItemParseStatus; title: string; priceKopecks: number | null; sourceUrl: string | null };

export function parseHint(item: HintItem): string | null {
  if (item.parseStatus !== "partial" && item.parseStatus !== "failed") return null;
  const store = item.sourceUrl ? detectStore(item.sourceUrl).label : "Магазин";
  const missing = [item.title === "" ? "название" : null, item.priceKopecks === null ? "цену" : null].filter((field) => field !== null);
  if (missing.length === 0) return null;
  if (item.title === "" && item.sourceUrl && OZON_SHORT_LINK.test(item.sourceUrl)) {
    return "Ozon не открывает короткие ссылки — вставьте полную ссылку на товар или впишите название";
  }
  if (missing.length === 1 && missing[0] === "цену") return `${store} не отдал цену — впишите её`;
  return `${store} не отдал данные — впишите ${missing.join(" и ")}`;
}

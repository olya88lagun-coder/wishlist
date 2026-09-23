import { and, eq, isNull } from "drizzle-orm";
import { isUuid } from "./errors";
import { affiliateClicks, items, storeSearchClicks, wishlists } from "./schema";
import type { Database } from "./types";

export type GoTarget = { itemId: string; ownerId: string; sourceUrl: string; store: string | null };

const AFFILIATE_ENV_BY_STORE: Record<string, string> = {
  wildberries: "AFFILIATE_WILDBERRIES_TEMPLATE",
  ozon: "AFFILIATE_OZON_TEMPLATE",
  goldapple: "AFFILIATE_GOLDAPPLE_TEMPLATE",
  lamoda: "AFFILIATE_LAMODA_TEMPLATE",
  yandex_market: "AFFILIATE_YANDEX_MARKET_TEMPLATE",
  other: "AFFILIATE_OTHER_TEMPLATE",
};

export async function getGoTarget(db: Database, itemId: string): Promise<GoTarget | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({ itemId: items.id, ownerId: wishlists.ownerId, sourceUrl: items.sourceUrl, store: items.store })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .where(and(eq(items.id, itemId), isNull(items.deletedAt)));
  return row?.sourceUrl ? { ...row, sourceUrl: row.sourceUrl } : null;
}

export function getAffiliateUrl(sourceUrl: string, store: string | null): string {
  const envName = store ? AFFILIATE_ENV_BY_STORE[store] : undefined;
  const template = envName ? process.env[envName] : undefined;

  if (!template) return sourceUrl;

  try {
    const affiliateUrl = template.replaceAll("{url}", encodeURIComponent(sourceUrl));
    const parsed = new URL(affiliateUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return sourceUrl;
    return parsed.toString();
  } catch {
    return sourceUrl;
  }
}

// Статистика: только подарок и магазин, никаких данных о том, кто перешёл.
export async function recordAffiliateClick(db: Database, p: { itemId: string; store: string | null }): Promise<void> {
  await db.insert(affiliateClicks).values(p);
}

// Статистика по переходам из подборщика и блоков идей: магазин, страница и сам поисковый запрос.
// Данных о госте нет, запрос — это текст идеи подарка, а не то, что человек написал о себе.
export async function recordStoreSearchClick(db: Database, p: { store: string; source: string; query: string }): Promise<void> {
  await db.insert(storeSearchClicks).values({ store: p.store, source: p.source.slice(0, 60), query: p.query.slice(0, 160) });
}

import { and, eq, isNull } from "drizzle-orm";
import { isUuid } from "./errors";
import { affiliateClicks, items, wishlists } from "./schema";
import type { Database } from "./types";

export type GoTarget = { itemId: string; ownerId: string; sourceUrl: string; store: string | null };

export async function getGoTarget(db: Database, itemId: string): Promise<GoTarget | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({ itemId: items.id, ownerId: wishlists.ownerId, sourceUrl: items.sourceUrl, store: items.store })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .where(and(eq(items.id, itemId), isNull(items.deletedAt)));
  return row?.sourceUrl ? { ...row, sourceUrl: row.sourceUrl } : null;
}

// Статистика: только подарок и магазин, никаких данных о том, кто перешёл
export async function recordAffiliateClick(db: Database, p: { itemId: string; store: string | null }): Promise<void> {
  await db.insert(affiliateClicks).values(p);
}

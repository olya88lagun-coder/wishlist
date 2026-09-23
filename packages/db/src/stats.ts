import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { countInterest, FEATURE_THEMES } from "./interest";
import { affiliateClicks, aiUsage, items, reservations, storeSearchClicks, users, wishlists } from "./schema";
import type { Database } from "./types";

export type AdminStats = {
  users: { total: number; new: number };
  wishlists: { total: number; new: number; withThreeItems: number; withReservations: number };
  items: { new: number };
  reservations: { new: number };
  storeVisits: { new: number; byStore: { store: string; count: number }[] };
  // Переходы в поиск магазина из подборщика и со страниц подарков
  storeSearches: { new: number; byStore: { store: string; count: number }[]; topSources: { source: string; count: number }[] };
  ai: { requests: number; attempts: number; failedAttempts: number; costMicroRub: number };
  themeInterest: number;
};

const TOP_SOURCES = 5;

const MIN_ITEMS_FOR_ACTIVE_LIST = 3;

export async function adminStats(db: Database, since: Date): Promise<AdminStats> {
  const [usersTotal] = await db.select({ n: count() }).from(users);
  const [usersNew] = await db.select({ n: count() }).from(users).where(gte(users.createdAt, since));
  const [listsTotal] = await db.select({ n: count() }).from(wishlists);
  const [listsNew] = await db.select({ n: count() }).from(wishlists).where(gte(wishlists.createdAt, since));
  // Доля списков с 3+ подарками — метрика из спеки: список, в который правда что-то добавили
  const [active] = await db.select({ n: sql<number>`count(*)::int` }).from(
    db
      .select({ wishlistId: items.wishlistId })
      .from(items)
      .where(isNull(items.deletedAt))
      .groupBy(items.wishlistId)
      .having(sql`count(*) >= ${MIN_ITEMS_FOR_ACTIVE_LIST}`)
      .as("active_lists"),
  );
  const [reserved] = await db
    .select({ n: sql<number>`count(distinct ${items.wishlistId})::int` })
    .from(reservations)
    .innerJoin(items, and(eq(items.id, reservations.itemId), isNull(items.deletedAt)))
    .where(eq(reservations.status, "active"));
  const [itemsNew] = await db.select({ n: count() }).from(items).where(and(gte(items.createdAt, since), isNull(items.deletedAt)));
  const [reservationsNew] = await db.select({ n: count() }).from(reservations).where(gte(reservations.createdAt, since));
  const byStore = await db
    .select({ store: sql<string>`coalesce(${affiliateClicks.store}, 'other')`, count: sql<number>`count(*)::int` })
    .from(affiliateClicks)
    .where(gte(affiliateClicks.clickedAt, since))
    .groupBy(sql`coalesce(${affiliateClicks.store}, 'other')`)
    .orderBy(desc(sql`count(*)`));

  const searchesByStore = await db
    .select({ store: storeSearchClicks.store, count: sql<number>`count(*)::int` })
    .from(storeSearchClicks)
    .where(gte(storeSearchClicks.clickedAt, since))
    .groupBy(storeSearchClicks.store)
    .orderBy(desc(sql`count(*)`));
  const topSources = await db
    .select({ source: storeSearchClicks.source, count: sql<number>`count(*)::int` })
    .from(storeSearchClicks)
    .where(gte(storeSearchClicks.clickedAt, since))
    .groupBy(storeSearchClicks.source)
    .orderBy(desc(sql`count(*)`))
    .limit(TOP_SOURCES);
  const [ai] = await db
    .select({
      requests: sql<number>`count(*) filter (where ${aiUsage.attempt} = 1)::int`,
      attempts: sql<number>`count(*)::int`,
      failedAttempts: sql<number>`count(*) filter (where ${aiUsage.outcome} <> 'ok')::int`,
      costMicroRub: sql<number>`coalesce(sum(${aiUsage.costMicroRub}), 0)::bigint`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since));

  return {
    users: { total: usersTotal?.n ?? 0, new: usersNew?.n ?? 0 },
    wishlists: { total: listsTotal?.n ?? 0, new: listsNew?.n ?? 0, withThreeItems: active?.n ?? 0, withReservations: reserved?.n ?? 0 },
    items: { new: itemsNew?.n ?? 0 },
    reservations: { new: reservationsNew?.n ?? 0 },
    storeVisits: { new: byStore.reduce((sum, row) => sum + row.count, 0), byStore },
    storeSearches: { new: searchesByStore.reduce((sum, row) => sum + row.count, 0), byStore: searchesByStore, topSources },
    ai: {
      requests: Number(ai?.requests ?? 0),
      attempts: Number(ai?.attempts ?? 0),
      failedAttempts: Number(ai?.failedAttempts ?? 0),
      costMicroRub: Number(ai?.costMicroRub ?? 0),
    },
    themeInterest: await countInterest(db, FEATURE_THEMES),
  };
}

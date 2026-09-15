import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { isUuid } from "./errors";
import { items, parseCache } from "./schema";
import type { Database } from "./types";

export const PARSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const PARSE_CACHE_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export type ItemForParsing = { id: string; sourceUrl: string; hasImage: boolean };

export type ParsedItemUpdate = {
  normalizedUrl: string;
  store: string;
  title: string | null;
  description: string | null;
  priceKopecks: number | null;
  imageKey: string | null;
};

export async function getItemForParsing(db: Database, itemId: string): Promise<ItemForParsing | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({ id: items.id, sourceUrl: items.sourceUrl, imageKey: items.imageKey })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.parseStatus, "pending"), isNull(items.deletedAt)));
  if (!row?.sourceUrl) return null;
  return { id: row.id, sourceUrl: row.sourceUrl, hasImage: row.imageKey !== null };
}

export async function applyParseResult(db: Database, itemId: string, sourceUrl: string, update: ParsedItemUpdate): Promise<boolean> {
  // В SET справа — значения строки до обновления: пустые поля заполняются, введённое владельцем остаётся
  const title = sql`case when ${items.title} = '' then ${update.title ?? ""} else ${items.title} end`;
  const price = sql`coalesce(${items.priceKopecks}, ${update.priceKopecks}::integer)`;
  const rows = await db
    .update(items)
    .set({
      normalizedUrl: update.normalizedUrl,
      store: update.store,
      title,
      description: sql`coalesce(${items.description}, ${update.description}::text)`,
      priceKopecks: price,
      imageKey: sql`coalesce(${items.imageKey}, ${update.imageKey}::text)`,
      parseStatus: sql`(case when (${title}) = '' then 'failed' when (${price}) is null then 'partial' else 'ok' end)::parse_status`,
    })
    .where(and(eq(items.id, itemId), eq(items.sourceUrl, sourceUrl), eq(items.parseStatus, "pending"), isNull(items.deletedAt)))
    .returning({ id: items.id });
  return rows.length > 0;
}

export async function readParseCache(db: Database, normalizedUrl: string, now = new Date()): Promise<unknown | null> {
  const [row] = await db
    .select({ result: parseCache.result, fetchedAt: parseCache.fetchedAt })
    .from(parseCache)
    .where(eq(parseCache.normalizedUrl, normalizedUrl));
  if (!row || now.getTime() - row.fetchedAt.getTime() > PARSE_CACHE_TTL_MS) return null;
  return row.result;
}

export async function writeParseCache(db: Database, normalizedUrl: string, result: unknown, now = new Date()): Promise<void> {
  await db
    .insert(parseCache)
    .values({ normalizedUrl, result, fetchedAt: now })
    .onConflictDoUpdate({ target: parseCache.normalizedUrl, set: { result, fetchedAt: now } });
}

export async function pruneParseCache(db: Database, now = new Date()): Promise<number> {
  const rows = await db
    .delete(parseCache)
    .where(lt(parseCache.fetchedAt, new Date(now.getTime() - PARSE_CACHE_KEEP_MS)))
    .returning({ url: parseCache.normalizedUrl });
  return rows.length;
}

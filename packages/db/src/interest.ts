import { and, count, eq } from "drizzle-orm";
import { featureInterest } from "./schema";
import type { Database } from "./types";

export const FEATURE_THEMES = "themes";
export type Feature = typeof FEATURE_THEMES;

export async function registerInterest(db: Database, userId: string, feature: Feature): Promise<"added" | "already"> {
  const inserted = await db
    .insert(featureInterest)
    .values({ userId, feature })
    .onConflictDoNothing()
    .returning({ userId: featureInterest.userId });
  return inserted.length > 0 ? "added" : "already";
}

export async function hasInterest(db: Database, userId: string, feature: Feature): Promise<boolean> {
  const [row] = await db
    .select({ userId: featureInterest.userId })
    .from(featureInterest)
    .where(and(eq(featureInterest.userId, userId), eq(featureInterest.feature, feature)))
    .limit(1);
  return row !== undefined;
}

export async function countInterest(db: Database, feature: Feature): Promise<number> {
  const [row] = await db.select({ total: count() }).from(featureInterest).where(eq(featureInterest.feature, feature));
  return row?.total ?? 0;
}

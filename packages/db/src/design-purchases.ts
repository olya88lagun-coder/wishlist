import { and, eq, isNull } from "drizzle-orm";
import { isUuid } from "./errors";
import { designPurchases, wishlists } from "./schema";
import type { Database } from "./types";

export type DesignProduct = "children" | "children_invitation" | "new_year";
export type WishlistTheme = "journal" | "children" | "children-pink" | "new-year";
export type DesignOrder = typeof designPurchases.$inferSelect;
export type DesignAccess = { theme: WishlistTheme; children: boolean; invitation: boolean; newYear: boolean };

export async function getDesignAccess(db: Database, wishlistId: string): Promise<DesignAccess> {
  if (!isUuid(wishlistId)) return { theme: "journal", children: false, invitation: false, newYear: false };
  const [list] = await db.select({ theme: wishlists.themeId }).from(wishlists).where(eq(wishlists.id, wishlistId));
  const paid = await db.select({ product: designPurchases.product }).from(designPurchases)
    .where(and(eq(designPurchases.wishlistId, wishlistId), eq(designPurchases.status, "succeeded"), eq(designPurchases.testMode, false)));
  const invitation = paid.some((p) => p.product === "children_invitation");
  const children = invitation || paid.some((p) => p.product === "children");
  const newYear = paid.some((p) => p.product === "new_year");
  const theme = newYear && list?.theme === "new-year" ? "new-year" : children && (list?.theme === "children" || list?.theme === "children-pink") ? list.theme : "journal";
  return { theme, children, invitation, newYear };
}

export async function beginDesignPurchase(db: Database, userId: string, wishlistId: string, product: DesignProduct, email: string, testMode = false): Promise<DesignOrder | null> {
  if (!isUuid(wishlistId) || !["children", "children_invitation", "new_year"].includes(product)) return null;
  return db.transaction(async (tx) => {
    const [list] = await tx.select({ id: wishlists.id }).from(wishlists)
      .where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, userId))).for("update");
    if (!list) return null;
    const orders = await tx.select().from(designPurchases).where(and(eq(designPurchases.wishlistId, wishlistId), eq(designPurchases.testMode, testMode)));
    const paid = orders.filter((o) => o.status === "succeeded");
    const bundle = paid.some((o) => o.product === "children_invitation");
    const theme = bundle || paid.some((o) => o.product === "children");
    const newYear = paid.some((o) => o.product === "new_year");
    if (product === "new_year" ? newYear : bundle || (product === "children" && theme)) return null;
    const pending = orders.find((o) => o.status === "pending");
    if (pending) return pending.product === product ? pending : null;
    const amountKopecks = product === "children_invitation" ? theme ? 5000 : 19900 : 14900;
    const [order] = await tx.insert(designPurchases).values({ userId, wishlistId, product, amountKopecks, email, testMode }).returning();
    return order ?? null;
  });
}

export async function attachDesignPayment(db: Database, orderId: string, paymentId: string, confirmationUrl: string | null) {
  await db.update(designPurchases).set({ paymentId, confirmationUrl })
    .where(and(eq(designPurchases.id, orderId), eq(designPurchases.status, "pending")));
}

export async function getDesignOrderByPayment(db: Database, paymentId: string): Promise<DesignOrder | null> {
  const [order] = await db.select().from(designPurchases).where(eq(designPurchases.paymentId, paymentId));
  return order ?? null;
}

export async function getPendingDesignOrders(db: Database, userId: string, wishlistId: string): Promise<DesignOrder[]> {
  if (!isUuid(wishlistId)) return [];
  return db.select().from(designPurchases).where(and(eq(designPurchases.userId, userId), eq(designPurchases.wishlistId, wishlistId), eq(designPurchases.status, "pending")));
}

export async function cancelDesignPayment(db: Database, orderId: string, paymentId: string) {
  await db.update(designPurchases).set({ status: "canceled" }).where(and(eq(designPurchases.id, orderId), eq(designPurchases.paymentId, paymentId), eq(designPurchases.status, "pending")));
}

export async function rejectUnattachedDesignPurchase(db: Database, orderId: string) {
  await db.update(designPurchases).set({ status: "rejected" }).where(and(eq(designPurchases.id, orderId), isNull(designPurchases.paymentId), eq(designPurchases.status, "pending")));
}

export async function confirmDesignPayment(db: Database, orderId: string, paymentId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(designPurchases).where(and(eq(designPurchases.id, orderId), eq(designPurchases.paymentId, paymentId))).for("update");
    if (!order || order.status === "canceled") return false;
    if (order.status === "succeeded") return true;
    await tx.update(designPurchases).set({ status: "succeeded" }).where(eq(designPurchases.id, order.id));
    if (!order.testMode) await tx.update(wishlists).set({ themeId: order.product === "new_year" ? "new-year" : "children" }).where(and(eq(wishlists.id, order.wishlistId), eq(wishlists.ownerId, order.userId)));
    return true;
  });
}

export async function setWishlistTheme(db: Database, userId: string, wishlistId: string, theme: WishlistTheme): Promise<boolean> {
  if (!isUuid(wishlistId) || !["journal", "children", "children-pink", "new-year"].includes(theme)) return false;
  if (theme !== "journal") {
    const access = await getDesignAccess(db, wishlistId);
    if (theme === "new-year" ? !access.newYear : !access.children) return false;
  }
  const rows = await db.update(wishlists).set({ themeId: theme }).where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, userId))).returning({ id: wishlists.id });
  return rows.length > 0;
}

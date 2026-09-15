import { randomBytes } from "node:crypto";
import { decideCancel, decideReserve, isValidSlug, type ItemReservationState, type Viewer } from "@wishlist/core";
import { and, eq, isNull } from "drizzle-orm";
import { isUniqueViolation, isUuid } from "./errors";
import { items, reservations, wishlists } from "./schema";
import type { Database } from "./types";

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "OWNER_CANNOT_RESERVE" | "ALREADY_RESERVED" | "NO_IDENTITY" | "INVALID_NAME" };

export type CancelResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_RESERVED" | "NOT_YOUR_RESERVATION" };

const CANCEL_TOKEN_BYTES = 24;

async function loadState(db: Database, slug: string, itemId: string): Promise<{ state: ItemReservationState; reservationId: string | null } | null> {
  if (!isValidSlug(slug) || !isUuid(itemId)) return null;
  const [row] = await db
    .select({
      ownerId: wishlists.ownerId,
      reservationId: reservations.id,
      guestUserId: reservations.guestUserId,
      guestToken: reservations.guestToken,
      guestName: reservations.guestName,
    })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .leftJoin(reservations, and(eq(reservations.itemId, items.id), eq(reservations.status, "active")))
    .where(and(eq(items.id, itemId), eq(wishlists.slug, slug), isNull(items.deletedAt)));
  if (!row) return null;
  const active = row.reservationId
    ? { guestUserId: row.guestUserId, guestToken: row.guestToken, guestName: row.guestName ?? "" }
    : null;
  return { state: { ownerId: row.ownerId, active }, reservationId: row.reservationId };
}

export async function reserveItem(
  db: Database,
  p: { slug: string; itemId: string; viewer: Viewer; guestName: string },
): Promise<ReserveResult> {
  const loaded = await loadState(db, p.slug, p.itemId);
  if (!loaded) return { ok: false, reason: "NOT_FOUND" };
  const decision = decideReserve(loaded.state, p.viewer, p.guestName);
  if (!decision.ok) return decision;
  try {
    await db.insert(reservations).values({
      itemId: p.itemId,
      guestUserId: p.viewer.userId,
      guestToken: p.viewer.guestToken,
      guestName: decision.guestName,
      cancelToken: randomBytes(CANCEL_TOKEN_BYTES).toString("base64url"),
    });
    return { ok: true };
  } catch (error) {
    // Гонка двух гостей: частичный уникальный индекс пропускает только одну активную бронь
    if (isUniqueViolation(error)) return { ok: false, reason: "ALREADY_RESERVED" };
    throw error;
  }
}

export async function cancelReservation(db: Database, p: { slug: string; itemId: string; viewer: Viewer }): Promise<CancelResult> {
  const loaded = await loadState(db, p.slug, p.itemId);
  if (!loaded) return { ok: false, reason: "NOT_FOUND" };
  const decision = decideCancel(loaded.state, p.viewer);
  if (!decision.ok) return decision;
  await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, loaded.reservationId!));
  return { ok: true };
}

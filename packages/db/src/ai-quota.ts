import { and, count, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { isUuid } from "./errors";
import { aiQuotaDays, aiQuotaReservations, aiUsage } from "./schema";
import type { Database } from "./types";

export type AiQuotaInput = {
  day: Date;
  clientHash: string;
  networkHash: string | null;
  signedIn: boolean;
  clientLimit: number;
  networkLimit: number;
  dailyBudgetMicroRub: number;
  reserveMicroRub: number;
};

export type AiQuotaResult =
  | { allowed: true; reservationId: string }
  | { allowed: false; reason: "client_daily_limit" | "network_daily_limit" | "daily_budget" };

function nonnegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be a nonnegative safe integer`);
}

function utcDay(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new RangeError("day must be a valid Date");
  const day = new Date(value);
  day.setUTCHours(0, 0, 0, 0);
  // Keep the next-day bound representable for the legacy usage window.
  if (!Number.isFinite(new Date(day.getTime() + 86_400_000).getTime())) throw new RangeError("day is out of range");
  return day;
}

export async function reserveAiQuota(db: Database, input: AiQuotaInput): Promise<AiQuotaResult> {
  const day = utcDay(input.day);
  const nextDay = new Date(day.getTime() + 86_400_000);
  for (const field of ["clientLimit", "networkLimit", "dailyBudgetMicroRub", "reserveMicroRub"] as const) {
    nonnegativeInteger(input[field], field);
  }
  if (input.reserveMicroRub === 0) throw new RangeError("reserveMicroRub must be positive");
  if (typeof input.clientHash !== "string" || !input.clientHash.trim()) throw new TypeError("clientHash must be nonempty");
  if (input.networkHash !== null && (typeof input.networkHash !== "string" || !input.networkHash.trim())) {
    throw new TypeError("networkHash must be nonempty or null");
  }
  if (typeof input.signedIn !== "boolean") throw new TypeError("signedIn must be boolean");

  return db.transaction<AiQuotaResult>(async (tx) => {
    await tx.insert(aiQuotaDays).values({ day }).onConflictDoNothing({ target: aiQuotaDays.day });
    await tx.select().from(aiQuotaDays).where(eq(aiQuotaDays.day, day)).for("update");

    const legacyDay = and(isNull(aiUsage.requestId), gte(aiUsage.createdAt, day), lt(aiUsage.createdAt, nextDay));
    const [reservedCount] = await tx.select({ value: count() }).from(aiQuotaReservations)
      .where(and(eq(aiQuotaReservations.day, day), eq(aiQuotaReservations.clientHash, input.clientHash)));
    const [legacyCount] = await tx.select({ value: count() }).from(aiUsage)
      .where(and(legacyDay, eq(aiUsage.clientHash, input.clientHash), eq(aiUsage.attempt, 1)));
    if (BigInt(reservedCount?.value ?? 0) + BigInt(legacyCount?.value ?? 0) >= BigInt(input.clientLimit)) {
      return { allowed: false, reason: "client_daily_limit" };
    }

    if (!input.signedIn && input.networkHash !== null) {
      const [networkCount] = await tx.select({ value: count() }).from(aiQuotaReservations).where(and(
        eq(aiQuotaReservations.day, day), eq(aiQuotaReservations.networkHash, input.networkHash), eq(aiQuotaReservations.signedIn, false),
      ));
      if (BigInt(networkCount?.value ?? 0) >= BigInt(input.networkLimit)) {
        return { allowed: false, reason: "network_daily_limit" };
      }
    }

    // Sum as text/BigInt: aggregate totals can exceed Number.MAX_SAFE_INTEGER
    // even though each validated reservation fits in a JavaScript number.
    const [reservedCost] = await tx.select({
      value: sql<string>`coalesce(sum(coalesce(${aiQuotaReservations.settledMicroRub}, ${aiQuotaReservations.reservedMicroRub})), 0)::text`,
    }).from(aiQuotaReservations).where(eq(aiQuotaReservations.day, day));
    const [legacyCost] = await tx.select({ value: sql<string>`coalesce(sum(${aiUsage.costMicroRub}), 0)::text` })
      .from(aiUsage).where(legacyDay);
    if (BigInt(reservedCost?.value ?? 0) + BigInt(legacyCost?.value ?? 0) + BigInt(input.reserveMicroRub) > BigInt(input.dailyBudgetMicroRub)) {
      return { allowed: false, reason: "daily_budget" };
    }

    const [reservation] = await tx.insert(aiQuotaReservations).values({
      day, clientHash: input.clientHash, networkHash: input.networkHash, signedIn: input.signedIn, reservedMicroRub: input.reserveMicroRub,
    }).returning({ id: aiQuotaReservations.id });
    if (!reservation) throw new Error("AI quota reservation was not stored");
    return { allowed: true, reservationId: reservation.id };
  });
}

// Lock the same day as admission before changing the charged amount. First
// settlement wins; retrying after a lost response cannot release the cost twice.
export async function settleAiQuota(db: Database, reservationId: string, chargedMicroRub: number): Promise<void> {
  if (!isUuid(reservationId)) throw new TypeError("reservationId must be a UUID");
  nonnegativeInteger(chargedMicroRub, "chargedMicroRub");
  await db.transaction(async (tx) => {
    const [reservation] = await tx.select({ day: aiQuotaReservations.day }).from(aiQuotaReservations)
      .where(eq(aiQuotaReservations.id, reservationId));
    if (!reservation) return;
    await tx.select().from(aiQuotaDays).where(eq(aiQuotaDays.day, reservation.day)).for("update");
    await tx.update(aiQuotaReservations).set({ settledMicroRub: chargedMicroRub }).where(and(
      eq(aiQuotaReservations.id, reservationId), isNull(aiQuotaReservations.settledMicroRub),
    ));
  });
}

import { eq } from "drizzle-orm";
import { beforeEach, expect, test } from "vitest";
import { reserveAiQuota, settleAiQuota, type AiQuotaInput } from "./ai-quota";
import { aiQuotaReservations, aiUsage } from "./schema";
import { createTestDb } from "./testing";
import type { Database } from "./types";

let db: Database;
const day = new Date("2026-10-19T00:00:00Z");
const input = (over: Partial<AiQuotaInput> = {}): AiQuotaInput => ({
  day,
  clientHash: "client-a",
  networkHash: "network-a",
  signedIn: false,
  clientLimit: 3,
  networkLimit: 5,
  dailyBudgetMicroRub: 1_000,
  reserveMicroRub: 100,
  ...over,
});

beforeEach(async () => { db = await createTestDb(); });

test("concurrent requests cannot exceed the client daily limit", async () => {
  const results = await Promise.all(Array.from({ length: 12 }, () => reserveAiQuota(db, input())));
  expect(results.filter((result) => result.allowed)).toHaveLength(3);
  expect(results.filter((result) => !result.allowed)).toEqual(
    Array.from({ length: 9 }, () => ({ allowed: false, reason: "client_daily_limit" })),
  );
});

test("rotating guest cookies cannot exceed the shared network limit", async () => {
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveAiQuota(db, input({ clientHash: `client-${i}` }))));
  expect(results.filter((result) => result.allowed)).toHaveLength(5);
  expect(results.filter((result) => !result.allowed)).toEqual(
    Array.from({ length: 7 }, () => ({ allowed: false, reason: "network_daily_limit" })),
  );
  expect(await reserveAiQuota(db, input({ clientHash: "signed-in", signedIn: true }))).toMatchObject({ allowed: true });
  expect(await reserveAiQuota(db, input({ clientHash: "another-network", networkHash: "network-b" }))).toMatchObject({ allowed: true });
});

test("concurrent clients cannot exceed the global daily budget", async () => {
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveAiQuota(db, input({
    clientHash: `client-${i}`, networkHash: `network-${i}`, dailyBudgetMicroRub: 250,
  }))));
  expect(results.filter((result) => result.allowed)).toHaveLength(2);
  expect(results.filter((result) => !result.allowed)).toEqual(
    Array.from({ length: 10 }, () => ({ allowed: false, reason: "daily_budget" })),
  );
});

test("legacy usage counts first attempts and every cost without double counting linked usage", async () => {
  await db.insert(aiUsage).values([
    { clientHash: "client-a", provider: "test", model: "test", outcome: "ok", costMicroRub: 70, createdAt: day },
    { clientHash: "client-a", provider: "test", model: "test", outcome: "ok", attempt: 2, costMicroRub: 30, createdAt: day },
  ]);
  const first = await reserveAiQuota(db, input({ dailyBudgetMicroRub: 300 }));
  expect(first.allowed).toBe(true);
  if (!first.allowed) throw new Error("Expected a quota reservation");
  await db.insert(aiUsage).values({
    requestId: first.reservationId, clientHash: "client-a", provider: "test", model: "test", outcome: "ok", costMicroRub: 100, createdAt: day,
  });
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 300 }))).toMatchObject({ allowed: true });
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 300 }))).toEqual({ allowed: false, reason: "client_daily_limit" });
  expect(await reserveAiQuota(db, input({ clientHash: "another-client", dailyBudgetMicroRub: 300 }))).toEqual({ allowed: false, reason: "daily_budget" });
});

test("settlement releases only unused cost and remains idempotent", async () => {
  const first = await reserveAiQuota(db, input({ dailyBudgetMicroRub: 150 }));
  if (!first.allowed) throw new Error("Expected a quota reservation");
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 150 }))).toEqual({ allowed: false, reason: "daily_budget" });
  await Promise.all([
    settleAiQuota(db, first.reservationId, 40),
    settleAiQuota(db, first.reservationId, 40),
  ]);
  await settleAiQuota(db, first.reservationId, 0);
  const [stored] = await db.select().from(aiQuotaReservations).where(eq(aiQuotaReservations.id, first.reservationId));
  expect(stored?.settledMicroRub).toBe(40);
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 150 }))).toMatchObject({ allowed: true });
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 150 }))).toEqual({ allowed: false, reason: "daily_budget" });
});

test("abandoned reservations remain charged for the entire day", async () => {
  const first = await reserveAiQuota(db, input({ dailyBudgetMicroRub: 150 }));
  if (!first.allowed) throw new Error("Expected a quota reservation");
  await db.update(aiQuotaReservations).set({ createdAt: new Date("2026-10-18T00:00:00Z") }).where(eq(aiQuotaReservations.id, first.reservationId));
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 150 }))).toEqual({ allowed: false, reason: "daily_budget" });
});

test("zero-cost settlement releases budget while preserving the request count", async () => {
  const first = await reserveAiQuota(db, input({ clientLimit: 1, dailyBudgetMicroRub: 100 }));
  if (!first.allowed) throw new Error("Expected a quota reservation");
  await settleAiQuota(db, first.reservationId, 0);
  expect(await reserveAiQuota(db, input({ clientLimit: 1, dailyBudgetMicroRub: 100 }))).toEqual({ allowed: false, reason: "client_daily_limit" });
  expect(await reserveAiQuota(db, input({ clientHash: "client-b", dailyBudgetMicroRub: 100 }))).toMatchObject({ allowed: true });
});

test("settlement can conservatively charge more than the reserve", async () => {
  const first = await reserveAiQuota(db, input({ dailyBudgetMicroRub: 250 }));
  if (!first.allowed) throw new Error("Expected a quota reservation");
  await settleAiQuota(db, first.reservationId, 200);
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 250 }))).toEqual({ allowed: false, reason: "daily_budget" });
});

test("large safe integer amounts remain exact in bigint columns and budget totals", async () => {
  const large = Number.MAX_SAFE_INTEGER;
  const first = await reserveAiQuota(db, input({ dailyBudgetMicroRub: large, reserveMicroRub: large - 1 }));
  if (!first.allowed) throw new Error("Expected a quota reservation");
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: large, reserveMicroRub: 2 }))).toEqual({ allowed: false, reason: "daily_budget" });
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: large, reserveMicroRub: 1 }))).toMatchObject({ allowed: true });
  await settleAiQuota(db, first.reservationId, large);
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: large, reserveMicroRub: 1 }))).toEqual({ allowed: false, reason: "daily_budget" });
});

test("UTC day boundaries reset reservations and exclude legacy records outside the day", async () => {
  await db.insert(aiUsage).values([
    { clientHash: "client-a", provider: "test", model: "test", outcome: "ok", costMicroRub: 999, createdAt: new Date("2026-10-18T23:59:59.999Z") },
    { clientHash: "client-a", provider: "test", model: "test", outcome: "ok", costMicroRub: 999, createdAt: new Date("2026-10-20T00:00:00Z") },
  ]);
  expect(await reserveAiQuota(db, input({ clientLimit: 1, dailyBudgetMicroRub: 100 }))).toMatchObject({ allowed: true });
  expect(await reserveAiQuota(db, input({ day: new Date("2026-10-19T23:59:59Z"), clientLimit: 1 }))).toEqual({ allowed: false, reason: "client_daily_limit" });
  expect(await reserveAiQuota(db, input({ day: new Date("2026-10-20T00:00:00Z"), clientHash: "client-b", dailyBudgetMicroRub: 1_099 }))).toMatchObject({ allowed: true });
});

test("signed in reservations do not consume guest network quota", async () => {
  expect(await reserveAiQuota(db, input({ signedIn: true, clientHash: "signed-in", networkLimit: 1 }))).toMatchObject({ allowed: true });
  expect(await reserveAiQuota(db, input({ clientHash: "guest-a", networkLimit: 1 }))).toMatchObject({ allowed: true });
  expect(await reserveAiQuota(db, input({ clientHash: "guest-b", networkLimit: 1 }))).toEqual({ allowed: false, reason: "network_daily_limit" });
});

test.each([
  { clientLimit: -1 }, { networkLimit: 1.5 }, { dailyBudgetMicroRub: Number.MAX_SAFE_INTEGER + 1 },
  { reserveMicroRub: 0 }, { reserveMicroRub: NaN }, { day: new Date(NaN) }, { clientHash: "" }, { networkHash: " " },
])("rejects invalid quota inputs before writing: %j", async (over) => {
  await expect(reserveAiQuota(db, input(over))).rejects.toThrow();
  expect(await db.select().from(aiQuotaReservations)).toHaveLength(0);
});

test("zero limits and insufficient budget deny the first request", async () => {
  expect(await reserveAiQuota(db, input({ clientLimit: 0 }))).toEqual({ allowed: false, reason: "client_daily_limit" });
  expect(await reserveAiQuota(db, input({ networkLimit: 0 }))).toEqual({ allowed: false, reason: "network_daily_limit" });
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 99 }))).toEqual({ allowed: false, reason: "daily_budget" });
});

test("rejects invalid settlement amounts without releasing the reservation", async () => {
  const first = await reserveAiQuota(db, input({ dailyBudgetMicroRub: 150 }));
  if (!first.allowed) throw new Error("Expected a quota reservation");
  await expect(settleAiQuota(db, first.reservationId, -1)).rejects.toThrow();
  await expect(settleAiQuota(db, first.reservationId, 1.5)).rejects.toThrow();
  await expect(settleAiQuota(db, first.reservationId, Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow();
  expect(await reserveAiQuota(db, input({ dailyBudgetMicroRub: 150 }))).toEqual({ allowed: false, reason: "daily_budget" });
});

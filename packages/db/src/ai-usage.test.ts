import { beforeEach, expect, test } from "vitest";
import { countAiRequestsSince, recordAiUsage, sumAiCostSince } from "./ai-usage";
import { createTestDb } from "./testing";
import type { Database } from "./types";

let db: Database;

const usage = (over: Partial<Parameters<typeof recordAiUsage>[1]> = {}) => ({
  clientHash: "hash-a",
  signedIn: false,
  provider: "routerai",
  model: "openai/gpt-oss-120b",
  attempt: 1,
  inputTokens: 1500,
  outputTokens: 350,
  reasoningTokens: 120,
  costMicroRub: 13_950,
  latencyMs: 1200,
  outcome: "ok" as const,
  ...over,
});

beforeEach(async () => {
  db = await createTestDb();
});

test("counts only the first attempt of each request for the client limit", async () => {
  await recordAiUsage(db, usage());
  await recordAiUsage(db, usage({ attempt: 2 }));
  await recordAiUsage(db, usage());
  await recordAiUsage(db, usage({ clientHash: "hash-b" }));

  const since = new Date(Date.now() - 60_000);
  expect(await countAiRequestsSince(db, "hash-a", since)).toBe(2);
  expect(await countAiRequestsSince(db, "hash-b", since)).toBe(1);
  expect(await countAiRequestsSince(db, "hash-c", since)).toBe(0);
});

test("sums the cost of every attempt across clients", async () => {
  await recordAiUsage(db, usage());
  await recordAiUsage(db, usage({ attempt: 2, costMicroRub: 10_000 }));
  await recordAiUsage(db, usage({ clientHash: "hash-b", costMicroRub: 1_050 }));

  expect(await sumAiCostSince(db, new Date(Date.now() - 60_000))).toBe(25_000);
});

test("ignores records made before the window", async () => {
  await recordAiUsage(db, usage());
  const tomorrow = new Date(Date.now() + 60_000);
  expect(await countAiRequestsSince(db, "hash-a", tomorrow)).toBe(0);
  expect(await sumAiCostSince(db, tomorrow)).toBe(0);
});

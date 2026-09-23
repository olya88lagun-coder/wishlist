import { and, count, eq, gte, sum } from "drizzle-orm";
import { aiUsage } from "./schema";
import type { Database } from "./types";

export type AiUsageRecord = {
  clientHash: string;
  signedIn: boolean;
  provider: string;
  model: string;
  attempt: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costMicroRub: number;
  latencyMs: number;
  outcome: "ok" | "invalid" | "error";
};

export async function recordAiUsage(db: Database, usage: AiUsageRecord): Promise<void> {
  await db.insert(aiUsage).values(usage);
}

// Сколько подборок клиент запросил с указанного момента: считаем только первые попытки,
// чтобы повтор из-за слабого ответа не съедал лимит пользователя.
export async function countAiRequestsSince(db: Database, clientHash: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.clientHash, clientHash), eq(aiUsage.attempt, 1), gte(aiUsage.createdAt, since)));
  return Number(row?.value ?? 0);
}

// Потрачено всего с указанного момента, в микрорублях
export async function sumAiCostSince(db: Database, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: sum(aiUsage.costMicroRub) })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since));
  return Number(row?.value ?? 0);
}

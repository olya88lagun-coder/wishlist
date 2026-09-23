import { describe, expect, test } from "vitest";
import {
  costMicroRub,
  decideBudget,
  formatRub,
  hashClientKey,
  priceFor,
  readLimits,
  readTokenUsage,
  startOfUtcDay,
} from "./ai-budget";

describe("readTokenUsage", () => {
  test("reads the RouterAI shape and keeps reasoning out of output tokens", () => {
    expect(readTokenUsage({ usage: { prompt_tokens: 1500, completion_tokens: 400, completion_tokens_details: { reasoning_tokens: 120 } } }))
      .toEqual({ inputTokens: 1500, outputTokens: 280, reasoningTokens: 120 });
  });

  test("reads the OpenAI responses shape", () => {
    expect(readTokenUsage({ usage: { input_tokens: 900, output_tokens: 350, output_tokens_details: { reasoning_tokens: 0 } } }))
      .toEqual({ inputTokens: 900, outputTokens: 350, reasoningTokens: 0 });
  });

  test("returns zeros when the provider sent no usage", () => {
    expect(readTokenUsage(null)).toEqual({ inputTokens: 0, outputTokens: 0, reasoningTokens: 0 });
    expect(readTokenUsage({})).toEqual({ inputTokens: 0, outputTokens: 0, reasoningTokens: 0 });
  });
});

describe("costMicroRub", () => {
  test("charges reasoning tokens at the output rate", () => {
    const price = priceFor("routerai", "openai/gpt-oss-120b");
    // 1500 × 3,30 ₽/млн + (350 + 150) × 18 ₽/млн = 0,00495 + 0,009 = 0,01395 ₽
    const cost = costMicroRub({ inputTokens: 1500, outputTokens: 350, reasoningTokens: 150 }, price);
    expect(cost).toBe(13_950);
    expect(formatRub(cost)).toBe("0.01");
  });

  test("converts OpenAI dollar prices with the configured rate", () => {
    const price = priceFor("openai", "gpt-5.6-luna", { AI_USD_RUB: "100" } as unknown as NodeJS.ProcessEnv);
    expect(price).toEqual({ inputRubPerMillion: 20, outputRubPerMillion: 120 });
  });

  test("falls back to a deliberately high price for unknown models", () => {
    const known = priceFor("routerai", "openai/gpt-oss-120b");
    const unknown = priceFor("routerai", "some/new-model");
    expect(unknown.outputRubPerMillion).toBeGreaterThan(known.outputRubPerMillion);
  });
});

describe("readLimits", () => {
  test("uses defaults when nothing is configured", () => {
    expect(readLimits({} as unknown as NodeJS.ProcessEnv)).toEqual({ guestPerDay: 5, userPerDay: 30, dailyBudgetMicroRub: 50_000_000 });
  });

  test("reads the configured values", () => {
    expect(readLimits({ AI_DAILY_LIMIT_GUEST: "2", AI_DAILY_LIMIT_USER: "10", AI_DAILY_BUDGET_RUB: "50" } as unknown as NodeJS.ProcessEnv))
      .toEqual({ guestPerDay: 2, userPerDay: 10, dailyBudgetMicroRub: 50_000_000 });
  });

  test("ignores broken values", () => {
    expect(readLimits({ AI_DAILY_LIMIT_GUEST: "-3", AI_DAILY_BUDGET_RUB: "nope" } as unknown as NodeJS.ProcessEnv))
      .toEqual({ guestPerDay: 5, userPerDay: 30, dailyBudgetMicroRub: 50_000_000 });
  });
});

describe("decideBudget", () => {
  const limits = { guestPerDay: 5, userPerDay: 30, dailyBudgetMicroRub: 50_000_000 };

  test("lets a guest through under the limit", () => {
    expect(decideBudget({ signedIn: false, requestsToday: 4, spentTodayMicroRub: 0, limits })).toEqual({ allowed: true });
  });

  test("stops a guest at the daily limit while a signed-in person continues", () => {
    expect(decideBudget({ signedIn: false, requestsToday: 5, spentTodayMicroRub: 0, limits })).toEqual({ allowed: false, reason: "client_daily_limit" });
    expect(decideBudget({ signedIn: true, requestsToday: 5, spentTodayMicroRub: 0, limits })).toEqual({ allowed: true });
  });

  test("stops everyone once the daily budget is spent", () => {
    expect(decideBudget({ signedIn: true, requestsToday: 0, spentTodayMicroRub: 50_000_000, limits })).toEqual({ allowed: false, reason: "daily_budget" });
  });
});

test("hashClientKey hides the original key", () => {
  const hash = hashClientKey("ip:203.0.113.10");
  expect(hash).toHaveLength(32);
  expect(hash).not.toContain("203.0.113.10");
  expect(hashClientKey("ip:203.0.113.10")).toBe(hash);
  expect(hashClientKey("ip:203.0.113.11")).not.toBe(hash);
});

test("startOfUtcDay cuts the time off", () => {
  expect(startOfUtcDay(new Date("2026-09-23T18:45:12.000Z")).toISOString()).toBe("2026-09-23T00:00:00.000Z");
});

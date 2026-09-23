import { createHash } from "node:crypto";

// Деньги считаем в микрорублях (1 ₽ = 1 000 000), чтобы не хранить копейки во float.
const MICRO_RUB = 1_000_000;

export type TokenUsage = { inputTokens: number; outputTokens: number; reasoningTokens: number };

export type ModelPrice = {
  // Рублей за миллион токенов
  inputRubPerMillion: number;
  outputRubPerMillion: number;
};

// Цены на сентябрь 2026. Их стоит перепроверять: провайдеры меняют тарифы.
// RouterAI — рубли напрямую, OpenAI — доллары, поэтому курс задаётся переменной окружения.
const ROUTERAI_PRICES: Record<string, ModelPrice> = {
  "openai/gpt-oss-120b": { inputRubPerMillion: 3.3, outputRubPerMillion: 18 },
};
const ROUTERAI_FALLBACK: ModelPrice = { inputRubPerMillion: 30, outputRubPerMillion: 120 };

const OPENAI_PRICES_USD: Record<string, ModelPrice> = {
  "gpt-5.6-luna": { inputRubPerMillion: 0.2, outputRubPerMillion: 1.2 },
};
const OPENAI_FALLBACK_USD: ModelPrice = { inputRubPerMillion: 1.25, outputRubPerMillion: 10 };

function usdRate(env: NodeJS.ProcessEnv): number {
  const raw = Number(env.AI_USD_RUB);
  return Number.isFinite(raw) && raw > 0 ? raw : 100;
}

export function priceFor(provider: "routerai" | "openai", model: string, env: NodeJS.ProcessEnv = process.env): ModelPrice {
  if (provider === "routerai") return ROUTERAI_PRICES[model] ?? ROUTERAI_FALLBACK;
  const usd = OPENAI_PRICES_USD[model] ?? OPENAI_FALLBACK_USD;
  const rate = usdRate(env);
  return { inputRubPerMillion: usd.inputRubPerMillion * rate, outputRubPerMillion: usd.outputRubPerMillion * rate };
}

// Рассуждения оплачиваются как выходные токены
export function costMicroRub(usage: TokenUsage, price: ModelPrice): number {
  const input = (usage.inputTokens * price.inputRubPerMillion) / 1_000_000;
  const output = ((usage.outputTokens + usage.reasoningTokens) * price.outputRubPerMillion) / 1_000_000;
  return Math.round((input + output) * MICRO_RUB);
}

export function formatRub(microRub: number): string {
  return (microRub / MICRO_RUB).toFixed(2);
}

// Ответ провайдера сообщает расход по-разному: RouterAI в стиле chat/completions, OpenAI — в responses
export function readTokenUsage(payload: unknown): TokenUsage {
  const usage = (payload as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage) return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
  const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const outputDetails = usage.completion_tokens_details ?? usage.output_tokens_details;
  const reasoning = num((outputDetails as { reasoning_tokens?: unknown } | undefined)?.reasoning_tokens);
  const output = num(usage.completion_tokens) || num(usage.output_tokens);
  return {
    inputTokens: num(usage.prompt_tokens) || num(usage.input_tokens),
    // Часть провайдеров уже включает рассуждения в выходные токены — тогда не считаем их дважды
    outputTokens: reasoning > 0 && output > reasoning ? output - reasoning : output,
    reasoningTokens: reasoning,
  };
}

// Ключ клиента не храним: по хешу нельзя восстановить IP или идентификатор пользователя
export function hashClientKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type BudgetLimits = { guestPerDay: number; userPerDay: number; dailyBudgetMicroRub: number };

export function readLimits(env: NodeJS.ProcessEnv = process.env): BudgetLimits {
  const int = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
  };
  const rub = Number(env.AI_DAILY_BUDGET_RUB);
  return {
    guestPerDay: int(env.AI_DAILY_LIMIT_GUEST, 5),
    userPerDay: int(env.AI_DAILY_LIMIT_USER, 30),
    dailyBudgetMicroRub: Math.round((Number.isFinite(rub) && rub >= 0 ? rub : 50) * MICRO_RUB),
  };
}

export type BudgetDecision =
  | { allowed: true }
  | { allowed: false; reason: "client_daily_limit" | "daily_budget" };

export function decideBudget(p: {
  signedIn: boolean;
  requestsToday: number;
  spentTodayMicroRub: number;
  limits: BudgetLimits;
}): BudgetDecision {
  if (p.spentTodayMicroRub >= p.limits.dailyBudgetMicroRub) return { allowed: false, reason: "daily_budget" };
  const limit = p.signedIn ? p.limits.userPerDay : p.limits.guestPerDay;
  if (p.requestsToday >= limit) return { allowed: false, reason: "client_daily_limit" };
  return { allowed: true };
}

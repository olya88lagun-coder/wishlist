import { recordAiUsage, reserveAiQuota, settleAiQuota } from "@wishlist/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  costMicroRub,
  hashClientKey,
  priceFor,
  readLimits,
  readTokenUsage,
  startOfUtcDay,
} from "@/server/ai-budget";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { aiNetworkHash, guestNetworkLimit, hasBillableUsage, reservationCost } from "@/server/ai-request-quota";
import { openAiResponseText } from "@/server/openai-response-text";
import { giftAiLimiter } from "@/server/rate-limit";
import { readViewer } from "@/server/viewer";

const inputSchema = z.object({
  person: z.string().min(1).max(40),
  occasion: z.string().min(1).max(40),
  interests: z.string().max(500).default(""),
  budget: z.string().max(40),
});

const outputSchema = z.object({
  ideas: z.array(z.object({
    title: z.string().min(1).max(120),
    reason: z.string().min(1).max(500),
    type: z.string().min(1).max(40),
    searchQuery: z.string().min(2).max(160),
  })).min(3).max(6),
});

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ideas: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          type: { type: "string" },
          searchQuery: { type: "string" },
        },
        required: ["title", "reason", "type", "searchQuery"],
      },
    },
  },
  required: ["ideas"],
};

const systemPrompt = `Ты — AI-помощник по подаркам для My Wish List.

Твоя задача — не искать товары и не придумывать ссылки. Подбери 5 персональных ИДЕЙ подарков, которые человек сможет найти в российских интернет-магазинах.

Главное: пользователь должен почувствовать, что подборка сделана именно под человека, повод, интересы и бюджет, а не взята из общего списка подарков.

Правила:
1. Учитывай все четыре входных параметра: человек, повод, интересы и бюджет. Если интересы указаны, минимум 4 из 5 идей должны явно опираться на них.
2. Бюджет — жёсткое ограничение. Предлагай варианты, которые обычно реально найти в указанном бюджете. Для бюджета до 5 000 ₽ не предлагай крупную бытовую технику, дорогие впечатления, мебель, постельные комплекты и другие очевидно дорогие категории. Для меньшего бюджета выбирай компактные, доступные подарки.
3. Не заполняй подборку generic-подарками вроде «кулинарная книга», «постельное бельё», «ароматические свечи» или «сертификат», если интересы пользователя прямо этого не подсказывают. Такие идеи допустимы только когда они логично связаны с вводными.
4. Предлагай конкретные типы подарков, а не слишком общие категории. Лучше «набор для альтернативного кофе дома» чем просто «кофе».
5. Сделай 5 идей, которые максимально релевантны именно этим вводным. Не добавляй идею только ради разнообразия и не меняй тему подарка ради искусственного баланса. Если человек увлекается конкретным хобби, нормально предложить несколько разных подарков внутри этой темы.
6. Не называй конкретные бренды, цены, модели или товары, наличие которых нельзя проверить.
7. Для каждой идеи создай короткий searchQuery — 3–8 слов, по которому пользователь сможет найти подходящие варианты на Ozon, Wildberries или Яндекс Маркете. Запрос должен быть конкретным и соответствовать бюджету.
8. searchQuery — обычный поисковый запрос на русском языке, без URL, кавычек и названий магазинов.
9. reason — одно короткое предложение: почему эта идея подходит именно этому человеку, интересам и поводу. Не повторяй название идеи дословно.
10. Все идеи должны заметно отличаться друг от друга и не быть вариациями одного подарка.
11. Если интересы указаны, используй их как главный сигнал, а не как второстепенную деталь. Если интересы не указаны, не выдумывай конкретные увлечения — выбирай нейтральные, но небанальные варианты, связанные с человеком, поводом и бюджетом.\n12. Не используй «кружка», «чашка», «свеча», «календарь», «чай», «носки», «шоколад», «сертификат», «аромамасла», «уход за руками» и похожие универсальные подарки, если только интересы пользователя прямо не делают их уместными.\n13. Верни только данные по заданной JSON-схеме.`;

function routerAiBody(data: z.infer<typeof inputSchema>, prompt = systemPrompt) {
  return {
    model: process.env.ROUTERAI_GIFT_MODEL && process.env.ROUTERAI_GIFT_MODEL !== "openai/gpt-5.5"
      ? process.env.ROUTERAI_GIFT_MODEL
      : "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(data) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "gift_ideas", strict: true, schema },
    },
    structured_outputs: true,
    reasoning: { effort: "low" },
    include_reasoning: false,
    temperature: 0.4,
    max_tokens: 1200,
  };
}

function openAiBody(data: z.infer<typeof inputSchema>, prompt = systemPrompt) {
  return {
    model: process.env.OPENAI_GIFT_MODEL ?? "gpt-5.6-luna",
    input: [
      { role: "system", content: [{ type: "input_text", text: prompt }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(data) }] },
    ],
    store: false,
    max_output_tokens: 1400,
    text: {
      format: { type: "json_schema", name: "gift_ideas", strict: true, schema },
    },
  };
}

const GENERIC_GIFT_PATTERNS = [
  "кружк", "чашк", "свеч", "календар", "чай", "носк", "шоколад",
  "сертификат", "аромамасл", "уход за руками", "постельн", "плед",
];

function isWeakGiftSet(ideas: z.infer<typeof outputSchema>["ideas"], interests: string) {
  const genericCount = ideas.filter((idea) => {
    const text = [idea.title, idea.reason, idea.searchQuery].join(" ").toLowerCase();
    return GENERIC_GIFT_PATTERNS.some((pattern) => text.includes(pattern));
  }).length;
  if (genericCount >= 3) return true;

  const interestTokens = interests
    .toLowerCase()
    .split(/[,/;\n]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);

  if (interestTokens.length > 0) {
    const relevantCount = ideas.filter((idea) => {
      const text = [idea.title, idea.reason, idea.searchQuery].join(" ").toLowerCase();
      return interestTokens.some((token) => text.includes(token));
    }).length;
    const required = interestTokens.length >= 2 ? 3 : 2;
    if (relevantCount < required) return true;
  }

  return false;
}

function parseJsonResponse(payload: any, useRouterAi: boolean): unknown {
  const message = useRouterAi ? payload?.choices?.[0]?.message : null;
  const rawContent = useRouterAi ? message?.content : openAiResponseText(payload);
  const toolArguments = useRouterAi && Array.isArray(message?.tool_calls)
    ? message.tool_calls.map((call: unknown) => {
        if (!call || typeof call !== "object") return "";
        const fn = (call as { function?: { arguments?: unknown } }).function;
        if (typeof fn?.arguments === "string") return fn.arguments;
        return fn?.arguments && typeof fn.arguments === "object" ? JSON.stringify(fn.arguments) : "";
      }).find(Boolean) ?? ""
    : "";

  const contentText = typeof rawContent === "string"
    ? rawContent
    : Array.isArray(rawContent)
      ? rawContent.map((part: unknown) => {
          if (!part || typeof part !== "object") return "";
          const item = part as { text?: unknown; content?: unknown };
          return typeof item.text === "string" ? item.text : typeof item.content === "string" ? item.content : "";
        }).join("")
      : "";

  const text = contentText.trim() ? contentText.trim() : toolArguments.trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text.replace(/^\s*\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`\s*$/i, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
      }
      return null;
    }
  }
}

export type ReadIdeasResult =
  | { success: true; ideas: z.infer<typeof outputSchema>["ideas"] }
  | { success: false; issues: string[] };

// Ответ модели считается пригодным, только если это валидный JSON нужной формы
export function readIdeas(payload: unknown, useRouterAi: boolean): ReadIdeasResult {
  const json = parseJsonResponse(payload, useRouterAi);
  if (!json) return { success: false, issues: ["empty or unparsable response"] };
  const parsedIdeas = outputSchema.safeParse(json);
  if (!parsedIdeas.success) return { success: false, issues: parsedIdeas.error.issues.map((issue) => issue.message) };
  return { success: true, ideas: parsedIdeas.data.ideas };
}

const formatRetryPrompt = systemPrompt + `

Предыдущий ответ не прошёл проверку формата. Верни строго JSON по заданной схеме: объект с полем ideas и пятью элементами, каждый с полями title, reason, type и searchQuery. Без пояснений, комментариев и текста вокруг JSON.`;

const qualityRetryPrompt = systemPrompt + `

Предыдущая попытка была слишком общей. Перегенерируй подборку с нуля.
Сделай интересы главным источником идей: если пользователь написал конкретное хобби или образ жизни, минимум 3 из 5 идей должны прямо использовать эту тему.
Не используй универсальные подарки из списка запретов, если только интересы не делают их явно уместными.
Не добавляй подарки ради разнообразия — все 5 идей должны быть релевантны человеку, поводу и бюджету.
`;

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

  const viewer = await readViewer();
  const networkHash = aiNetworkHash(request.headers, getEnv().SESSION_SECRET);
  const key = viewer.user ? `u:${viewer.user.id}` : viewer.viewer.guestToken ? `g:${viewer.viewer.guestToken}` : `network:${networkHash}`;
  if (!giftAiLimiter.allow(key) || (!viewer.user && !giftAiLimiter.allow(`ai-network:${networkHash}`))) {
    return NextResponse.json({ error: "Слишком много запросов. Попробуйте снова через минуту.", code: "RATE_LIMITED" }, { status: 429 });
  }

  // Дневные лимиты и бюджет живут в базе: они переживают перезапуск и общие для всех процессов
  const db = getDb();
  const signedIn = Boolean(viewer.user);
  const clientHash = hashClientKey(key);
  const since = startOfUtcDay();
  const limits = readLimits();
  const routerAiKey = process.env.ROUTERAI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!routerAiKey && !openAiKey) {
    return NextResponse.json({ error: "AI пока не подключён на сервере", code: "AI_NOT_CONFIGURED" }, { status: 503 });
  }
  const useRouterAi = Boolean(routerAiKey);
  const requestedModel = useRouterAi ? routerAiBody(parsed.data).model : openAiBody(parsed.data).model;
  const provider = useRouterAi ? "routerai" : "openai";
  const bodies = [systemPrompt, formatRetryPrompt, qualityRetryPrompt].map((prompt) => useRouterAi ? routerAiBody(parsed.data, prompt) : openAiBody(parsed.data, prompt));
  const requestPrice = priceFor(provider, requestedModel);
  const reservedMicroRub = reservationCost(bodies, requestPrice);
  const decision = await reserveAiQuota(db, {
    day: since, clientHash, networkHash, signedIn,
    clientLimit: signedIn ? limits.userPerDay : limits.guestPerDay,
    networkLimit: guestNetworkLimit(limits.guestPerDay), dailyBudgetMicroRub: limits.dailyBudgetMicroRub,
    reserveMicroRub: reservedMicroRub,
  });
  if (!decision.allowed) {
    if (decision.reason === "daily_budget") {
      console.warn("Gift AI daily budget reached");
      return NextResponse.json(
        { error: "AI-подбор сегодня недоступен: исчерпан дневной лимит сервиса. Попробуйте завтра.", code: "AI_BUDGET_REACHED" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: signedIn
          ? "Вы использовали все подборки на сегодня. Попробуйте завтра."
          : "Бесплатные подборки на сегодня закончились. Войдите, чтобы получить больше, или попробуйте завтра.",
        code: "AI_DAILY_LIMIT",
      },
      { status: 429 },
    );
  }

  const reservationId = decision.reservationId;
  const apiKey = useRouterAi ? routerAiKey : openAiKey;
  const endpoint = useRouterAi
    ? `${process.env.ROUTERAI_BASE_URL ?? "https://routerai.ru/api/v1"}/chat/completions`
    : "https://api.openai.com/v1/responses";

  let chargedMicroRub = 0;
  let unknownAttempts = 0;
  try {

    // Каждая попытка попадает в ai_usage: по ней считаются дневной бюджет и стоимость сессии
    async function record(attempt: number, payload: unknown, outcome: "ok" | "invalid" | "error", latencyMs: number) {
      const knownUsage = hasBillableUsage(payload);
      const usage = readTokenUsage(knownUsage ? payload : null);
      const payloadModel = (payload as { model?: unknown } | null)?.model;
      const model = typeof payloadModel === "string" ? payloadModel : requestedModel;
      // A returned alias cannot change the configured tariff after admission.
      const cost = costMicroRub(usage, requestPrice);
      if (knownUsage) { unknownAttempts--; chargedMicroRub += cost; }
      try {
        await recordAiUsage(db, {
          requestId: reservationId,
          clientHash,
          signedIn,
          provider,
          model,
          attempt,
          ...usage,
          costMicroRub: cost,
          latencyMs,
          outcome,
        });
      } catch (error) {
        console.error("Gift AI usage not recorded", error);
      }
    }

    // Номер попытки: по первым попыткам считается дневной лимит клиента
    let attempts = 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const startedAt = Date.now();
    let response: Response;
    let payload: unknown;

    try {
      unknownAttempts++;
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify(useRouterAi ? routerAiBody(parsed.data) : openAiBody(parsed.data)),
      });
      if (response.ok) payload = await response.json().catch(() => null);
    } catch {
      await record(1, null, "error", Date.now() - startedAt);
      return NextResponse.json({ error: "AI сейчас недоступен. Попробуйте ещё раз." }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      await record(1, null, "error", Date.now() - startedAt);
      return NextResponse.json(
        { error: response.status === 429 ? "AI временно перегружен. Попробуйте чуть позже." : "Не удалось получить рекомендации от AI" },
        { status: response.status === 429 ? 503 : 502 },
      );
    }

    let result = readIdeas(payload, useRouterAi);
    await record(1, payload, result.success ? "ok" : "invalid", Date.now() - startedAt);

    // Модель иногда отвечает не по схеме. Для человека это выглядит как ошибка сервиса,
    // поэтому повторяем один раз сами, прежде чем показывать сообщение.
    if (!result.success) {
      console.error("Gift AI bad response, retrying once", {
        issues: result.issues,
      });

      const formatController = new AbortController();
      const formatTimeout = setTimeout(() => formatController.abort(), 15_000);
      const formatStartedAt = Date.now();
      try {
        unknownAttempts++;
        const formatResponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          signal: formatController.signal,
          body: JSON.stringify(useRouterAi ? routerAiBody(parsed.data, formatRetryPrompt) : openAiBody(parsed.data, formatRetryPrompt)),
        });
        if (formatResponse.ok) {
          const formatPayload = await formatResponse.json();
          result = readIdeas(formatPayload, useRouterAi);
          await record(++attempts, formatPayload, result.success ? "ok" : "invalid", Date.now() - formatStartedAt);
        } else {
          await record(++attempts, null, "error", Date.now() - formatStartedAt);
        }
      } catch (error) {
        console.error("Gift AI format retry failed", error);
        await record(++attempts, null, "error", Date.now() - formatStartedAt);
      } finally {
        clearTimeout(formatTimeout);
      }
    }

    if (!result.success) {
      return NextResponse.json({ error: "AI не смог подобрать идеи. Попробуйте ещё раз." }, { status: 502 });
    }

    let ideas = result.ideas.slice(0, 6);

    if (isWeakGiftSet(ideas, parsed.data.interests)) {
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 15_000);
      const retryStartedAt = Date.now();
      try {
        unknownAttempts++;
        const retryResponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          signal: retryController.signal,
          body: JSON.stringify(useRouterAi ? routerAiBody(parsed.data, qualityRetryPrompt) : openAiBody(parsed.data, qualityRetryPrompt)),
        });
        if (retryResponse.ok) {
          const retryPayload = await retryResponse.json();
          const retryJson = parseJsonResponse(retryPayload, useRouterAi);
          const retryResult = outputSchema.safeParse(retryJson);
          await record(++attempts, retryPayload, retryResult.success ? "ok" : "invalid", Date.now() - retryStartedAt);
          if (retryResult.success && !isWeakGiftSet(retryResult.data.ideas, parsed.data.interests)) {
            ideas = retryResult.data.ideas.slice(0, 6);
          }
        } else {
          await record(++attempts, null, "error", Date.now() - retryStartedAt);
        }
      } catch (error) {
        console.error("Gift AI quality retry failed", error);
        await record(++attempts, null, "error", Date.now() - retryStartedAt);
      } finally {
        clearTimeout(retryTimeout);
      }
    }

    return NextResponse.json({ ideas });
  } finally {
    // A timeout, missing usage or process failure must never free an unknown bill.
    // If settlement itself fails, the original database reservation remains held.
    try {
      await settleAiQuota(db, reservationId, unknownAttempts > 0 ? Math.max(chargedMicroRub, reservedMicroRub) : chargedMicroRub);
    } catch (error) { console.error("Gift AI quota settlement failed", error); }
  }
}

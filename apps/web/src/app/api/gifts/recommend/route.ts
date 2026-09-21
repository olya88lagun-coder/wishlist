import { NextResponse } from "next/server";
import { z } from "zod";
import { giftAiLimiter } from "@/server/rate-limit";
import { clientKey, readViewer } from "@/server/viewer";

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
  const rawContent = useRouterAi ? message?.content : payload?.output_text;
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

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

  const viewer = await readViewer();
  if (!giftAiLimiter.allow(await clientKey(viewer.viewer))) {
    return NextResponse.json({ error: "Слишком много запросов. Попробуйте снова через минуту.", code: "RATE_LIMITED" }, { status: 429 });
  }

  const routerAiKey = process.env.ROUTERAI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!routerAiKey && !openAiKey) {
    return NextResponse.json({ error: "AI пока не подключён на сервере", code: "AI_NOT_CONFIGURED" }, { status: 503 });
  }

  const useRouterAi = Boolean(routerAiKey);
  const apiKey = useRouterAi ? routerAiKey : openAiKey;
  const endpoint = useRouterAi
    ? `${process.env.ROUTERAI_BASE_URL ?? "https://routerai.ru/api/v1"}/chat/completions`
    : "https://api.openai.com/v1/responses";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify(useRouterAi ? routerAiBody(parsed.data) : openAiBody(parsed.data)),
    });
  } catch {
    return NextResponse.json({ error: "AI сейчас недоступен. Попробуйте ещё раз." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: response.status === 429 ? "AI временно перегружен. Попробуйте чуть позже." : "Не удалось получить рекомендации от AI" },
      { status: response.status === 429 ? 503 : 502 },
    );
  }

  const payload = await response.json();
  const json = parseJsonResponse(payload, useRouterAi);

  if (!json) {
    console.error("Gift AI invalid or empty JSON", {
      model: payload?.model,
      finishReason: payload?.choices?.[0]?.finish_reason,
      preview: String(payload?.choices?.[0]?.message?.content ?? payload?.output_text ?? "").slice(0, 500),
    });
    return NextResponse.json({ error: "AI не смог подобрать идеи. Попробуйте ещё раз." }, { status: 502 });
  }

  const result = outputSchema.safeParse(json);
  if (!result.success) {
    console.error("Gift AI unexpected format", { model: payload?.model, issues: result.error.issues });
    return NextResponse.json({ error: "AI вернул данные неожиданного формата" }, { status: 502 });
  }

  let ideas = result.data.ideas.slice(0, 6);

  if (isWeakGiftSet(ideas, parsed.data.interests)) {
    const retryPrompt = systemPrompt + `

Предыдущая попытка была слишком общей. Перегенерируй подборку с нуля.
Сделай интересы главным источником идей: если пользователь написал конкретное хобби или образ жизни, минимум 3 из 5 идей должны прямо использовать эту тему.
Не используй универсальные подарки из списка запретов, если только интересы не делают их явно уместными.
Не добавляй подарки ради разнообразия — все 5 идей должны быть релевантны человеку, поводу и бюджету.
`;
    const retryController = new AbortController();
    const retryTimeout = setTimeout(() => retryController.abort(), 15_000);
    try {
      const retryResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: retryController.signal,
        body: JSON.stringify(useRouterAi ? routerAiBody(parsed.data, retryPrompt) : openAiBody(parsed.data, retryPrompt)),
      });
      if (retryResponse.ok) {
        const retryPayload = await retryResponse.json();
        const retryJson = parseJsonResponse(retryPayload, useRouterAi);
        const retryResult = outputSchema.safeParse(retryJson);
        if (retryResult.success && !isWeakGiftSet(retryResult.data.ideas, parsed.data.interests)) {
          ideas = retryResult.data.ideas.slice(0, 6);
        }
      }
    } catch (error) {
      console.error("Gift AI quality retry failed", error);
    } finally {
      clearTimeout(retryTimeout);
    }
  }

  return NextResponse.json({ ideas });
}

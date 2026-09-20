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
    productUrl: z.string().url().nullable(),
    store: z.string().max(80).nullable(),
    price: z.string().max(80).nullable(),
  })).min(1).max(6),
});

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ideas: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          type: { type: "string" },
          productUrl: { type: ["string", "null"] },
          store: { type: ["string", "null"] },
          price: { type: ["string", "null"] },
        },
        required: ["title", "reason", "type", "productUrl", "store", "price"],
      },
    },
  },
  required: ["ideas"],
};

const systemPrompt = `Ты — AI-помощник по подаркам для My Wish List.
Подбирай 3–6 конкретных подарков по получателю, поводу, интересам и бюджету.
Используй веб-поиск, чтобы найти актуальные реальные товары, доступные в русскоязычном интернете.
Предпочитай крупные магазины и маркетплейсы. Не выдумывай URL, цены, наличие или магазины.
Если подтверждённый URL товара найти нельзя, productUrl должен быть null.
Цена должна быть указана только если она видна в найденном источнике.
Не включай товары выше заданного бюджета, если бюджет можно определить.
reason — коротко объясни, почему подарок подходит.
Верни только данные по заданной JSON-схеме.`;

function routerAiBody(data: z.infer<typeof inputSchema>) {
  return {
    model: process.env.ROUTERAI_GIFT_MODEL ?? "openai/gpt-5.5",
    plugins: [{
      id: "web",
      max_results: 5,
      search_prompt: "Ищи актуальные и достоверные страницы реальных товаров и магазинов в русскоязычном интернете.",
    }],
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(data) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "gift_recommendations",
        strict: true,
        schema,
      },
    },
    structured_outputs: true,
    max_tokens: 1800,
  };
}

function openAiBody(data: z.infer<typeof inputSchema>) {
  return {
    model: process.env.OPENAI_GIFT_MODEL ?? "gpt-5.6-luna",
    tools: [{ type: "web_search" }],
    input: [
      { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify(data),
        }],
      },
    ],
    store: false,
    max_output_tokens: 1800,
    text: {
      format: {
        type: "json_schema",
        name: "gift_recommendations",
        strict: true,
        schema,
      },
    },
  };
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const viewer = await readViewer();
  if (!giftAiLimiter.allow(await clientKey(viewer.viewer))) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте снова через минуту.", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const routerAiKey = process.env.ROUTERAI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!routerAiKey && !openAiKey) {
    return NextResponse.json(
      { error: "AI пока не подключён на сервере", code: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const useRouterAi = Boolean(routerAiKey);
  const apiKey = useRouterAi ? routerAiKey : openAiKey;
  const endpoint = useRouterAi
    ? `${process.env.ROUTERAI_BASE_URL ?? "https://routerai.ru/api/v1"}/chat/completions`
    : "https://api.openai.com/v1/responses";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify(
        useRouterAi ? routerAiBody(parsed.data) : openAiBody(parsed.data),
      ),
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
  const text = useRouterAi
    ? payload?.choices?.[0]?.message?.content
    : payload?.output_text;

  if (typeof text !== "string" || !text) {
    return NextResponse.json({ error: "AI вернул пустой ответ" }, { status: 502 });
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "AI вернул некорректный ответ" }, { status: 502 });
  }

  const result = outputSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json({ error: "AI вернул данные неожиданного формата" }, { status: 502 });
  }

  return NextResponse.json(result.data);
}

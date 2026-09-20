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
    productUrl: z.string().url(),
    store: z.string().min(1).max(80),
    price: z.string().min(1).max(80),
  })).min(3).max(6),
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
          productUrl: { type: "string" },
          store: { type: "string" },
          price: { type: "string" },
        },
        required: ["title", "reason", "type", "productUrl", "store", "price"],
      },
    },
  },
  required: ["ideas"],
};

const systemPrompt = `Ты — AI-помощник по подаркам для My Wish List.
Твоя задача — найти 3–6 КОНКРЕТНЫХ ТОВАРОВ, которые человек реально может купить прямо сейчас.
Это не генерация идей. Нельзя возвращать категории, абстрактные идеи, подборки, статьи или выдуманные товары.

ОБЯЗАТЕЛЬНЫЙ АЛГОРИТМ:
1. Используй веб-поиск для поиска реальных карточек товаров.
2. Ищи именно страницы конкретных товаров, а не главные страницы магазинов, категории, статьи и обзоры.
3. Для каждого результата productUrl должен быть точным URL найденной карточки товара.
4. productUrl ОБЯЗАТЕЛЬНО должен быть URL из результатов веб-поиска. Никогда не придумывай URL.
5. store должен соответствовать магазину, на странице которого найден товар.
6. price указывай только по цене, видимой в найденном источнике. Не придумывай цену.
7. Не включай товар, если его цена выше бюджета.
8. Если подходящих реальных товаров меньше трёх, лучше верни только подтверждённые товары — сервер дополнительно проверит ссылки.
9. reason — 1 короткое предложение о том, почему именно этот товар подходит этому человеку и поводу.

Предпочитай реальные карточки товаров на Ozon, Wildberries, Яндекс Маркете, Золотом Яблоке и Lamoda.
Не возвращай просто «аромадиффузор», «плед» или «набор чая». Нужны конкретные товары с конкретными URL и ценами.
Верни только данные по заданной JSON-схеме.`;

function routerAiBody(data: z.infer<typeof inputSchema>) {
  return {
    model: process.env.ROUTERAI_GIFT_MODEL && process.env.ROUTERAI_GIFT_MODEL !== "openai/gpt-5.5"
      ? process.env.ROUTERAI_GIFT_MODEL
      : "deepseek/deepseek-v4.1-flash",
    plugins: [{
      id: "web",
      engine: "exa",
      max_results: 8,
      include_domains: ["ozon.ru", "wildberries.ru", "market.yandex.ru", "goldapple.ru", "lamoda.ru"],
      search_prompt: "Ищи конкретные карточки товаров с названием и ценой. Не используй статьи, категории, подборки или страницы поиска. Нужен прямой URL товара."
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
    max_tokens: 900,
  };
}


function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

function isAllowedProductUrl(value: string) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const url = new URL(normalized);
  const host = url.hostname;
  const path = url.pathname;

  if (host === "ozon.ru" || host === "www.ozon.ru") return /^\/product\/[^/]+-\d+(?:\/|$)/.test(path);
  if (host === "wildberries.ru" || host === "www.wildberries.ru") return /^\/catalog\/\d+\/detail\.aspx/.test(path);
  if (host === "market.yandex.ru") return /^\/product\/[^/]+\/\d+/.test(path) || /^\/product--[^/]+\/\d+/.test(path);
  if (host === "goldapple.ru" || host === "www.goldapple.ru") return /^\/product\/[^/]+/.test(path);
  if (host === "lamoda.ru" || host === "www.lamoda.ru") return /^\/p\/[^/]+/.test(path);
  return false;
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

  if (useRouterAi) {
    const annotations = payload?.choices?.[0]?.message?.annotations;
    const citedUrls = new Set<string>(
      Array.isArray(annotations)
        ? annotations
            .map((item: unknown) => {
              if (!item || typeof item !== "object") return null;
              const citation = (item as { url_citation?: { url?: unknown } }).url_citation;
              return typeof citation?.url === "string" ? citation.url : null;
            })
            .filter((url: unknown): url is string => typeof url === "string")
            .map(normalizeUrl)
            .filter((url: string | null): url is string => Boolean(url))
        : [],
    );

    const verifiedIdeas = result.data.ideas.filter((idea) => {
      const normalized = normalizeUrl(idea.productUrl);
      return Boolean(normalized && isAllowedProductUrl(idea.productUrl) && citedUrls.has(normalized));
    });

    if (verifiedIdeas.length < 3) {
      return NextResponse.json(
        { error: "Не удалось найти достаточно подтверждённых товаров. Попробуйте изменить запрос или бюджет." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ideas: verifiedIdeas.slice(0, 6) });
  }

  return NextResponse.json(result.data);
}

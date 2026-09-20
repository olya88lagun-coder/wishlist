import { NextResponse } from "next/server";
import { z } from "zod";

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

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI пока не подключён на сервере", code: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_GIFT_MODEL ?? "gpt-5.6-luna",
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        {
          role: "user",
          content: [{
            type: "input_text",
            text: JSON.stringify(parsed.data),
          }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "gift_recommendations",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Не удалось получить рекомендации от AI" }, { status: 502 });
  }

  const payload = await response.json();
  const text = typeof payload.output_text === "string" ? payload.output_text : "";
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

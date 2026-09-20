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
  })).min(1).max(6),
});

const systemPrompt = `Ты — AI-помощник по подаркам для сервиса My Wish List.
Подбирай конкретные типы подарков, а не абстрактные советы. Учитывай получателя, повод, интересы и бюджет.
Не выдумывай магазины, цены, наличие или ссылки: каталог товаров будет подключён отдельным шагом.
Верни только JSON формата {"ideas":[{"title":"...","reason":"...","type":"..."}]}.
`;

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

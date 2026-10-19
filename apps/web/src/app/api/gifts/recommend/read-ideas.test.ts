import { expect, test } from "vitest";
import { readIdeas } from "./route";

const idea = { title: "Набор для рассады", reason: "Продолжает её увлечение садом", type: "практичный", searchQuery: "набор для рассады подарок" };
const ideas = [idea, { ...idea, title: "Секатор" }, { ...idea, title: "Лампа для чтения" }];

function routerAiPayload(content: string) {
  return { choices: [{ message: { content } }] };
}

test("reads ideas from a RouterAI answer", () => {
  const result = readIdeas(routerAiPayload(JSON.stringify({ ideas })), true);
  expect(result.success && result.ideas).toHaveLength(3);
});

test("reads ideas wrapped in a markdown code block", () => {
  const result = readIdeas(routerAiPayload("```json\n" + JSON.stringify({ ideas }) + "\n```"), true);
  expect(result.success).toBe(true);
});

test("reads ideas from an OpenAI responses answer", () => {
  const result = readIdeas({ output_text: JSON.stringify({ ideas }) }, false);
  expect(result.success).toBe(true);
});

test("reads raw Responses items after reasoning and joins output text parts", () => {
  const text = JSON.stringify({ ideas });
  const payload = { status: "completed", output: [
    { type: "reasoning", summary: [] },
    { type: "message", role: "assistant", status: "completed", content: [
      { type: "output_text", text: text.slice(0, 30) }, { type: "output_text", text: text.slice(30) },
    ] },
  ] };
  expect(readIdeas(payload, false).success).toBe(true);
});

test("rejects incomplete Responses and refusals even with a convenient output_text", () => {
  for (const payload of [
    { status: "incomplete", output_text: JSON.stringify({ ideas }) },
    { status: "completed", output_text: JSON.stringify({ ideas }), output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "No" }] }] },
  ]) expect(readIdeas(payload, false).success).toBe(false);
});

test("reports an empty answer instead of throwing", () => {
  const result = readIdeas(routerAiPayload(""), true);
  expect(result).toEqual({ success: false, issues: ["empty or unparsable response"] });
});

test("reports an answer that does not match the schema", () => {
  const result = readIdeas(routerAiPayload(JSON.stringify({ ideas: [{ title: "Без причины" }] })), true);
  expect(result.success).toBe(false);
  expect(result.success === false && result.issues.length).toBeGreaterThan(0);
});

test("reports too few ideas", () => {
  const result = readIdeas(routerAiPayload(JSON.stringify({ ideas: [idea] })), true);
  expect(result.success).toBe(false);
});

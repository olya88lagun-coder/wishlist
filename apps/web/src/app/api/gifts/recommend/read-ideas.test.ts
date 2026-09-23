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

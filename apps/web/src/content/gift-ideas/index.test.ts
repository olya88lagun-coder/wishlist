import { describe, expect, test } from "vitest";
import { GIFT_IDEAS, countGiftIdeas, giftIdeaSearchLinks, giftIdeasCountLabel } from "./index";

const BUDGET_LIMITS: Record<string, number> = {
  "under-1000": 1000,
  "under-3000": 3000,
  "under-5000": 5000,
  "under-10000": 10000,
  "under-15000": 15000,
  "under-20000": 20000,
};

// Верхняя граница диапазона «2 000–6 000 ₽» или «от 10 000 ₽»
function upperPrice(price: string): number {
  const numbers = price.replace(/ |\s/g, "").match(/\d+/g);
  return numbers ? Number(numbers[numbers.length - 1]) : Number.NaN;
}

describe("gift ideas content", () => {
  const pages = Object.entries(GIFT_IDEAS);

  test("covers every gift page", () => {
    expect(pages).toHaveLength(31);
  });

  test.each(pages)("%s has at least ten complete ideas with unique names", (_slug, content) => {
    const ideas = content!.groups.flatMap((group) => group.ideas);
    expect(ideas.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ideas.map((idea) => idea.name)).size).toBe(ideas.length);
    expect(content!.title).not.toBe("");
    expect(content!.intro.length).toBeGreaterThan(40);
    expect(content!.avoid.length).toBeGreaterThan(0);
    for (const idea of ideas) {
      expect(idea.why.length).toBeGreaterThan(10);
      expect(idea.query.trim()).not.toBe("");
      expect(idea.price).toMatch(/₽$/);
      expect(upperPrice(idea.price)).toBeGreaterThan(0);
    }
  });

  test.each(Object.entries(BUDGET_LIMITS))("ideas on %s stay within the budget", (slug, limit) => {
    const ideas = GIFT_IDEAS[slug]!.groups.flatMap((group) => group.ideas);
    for (const idea of ideas) {
      expect({ name: idea.name, price: upperPrice(idea.price) }).toEqual({ name: idea.name, price: expect.any(Number) });
      expect(upperPrice(idea.price)).toBeLessThanOrEqual(limit);
    }
  });

  test("intros are not copied between pages", () => {
    const intros = pages.map(([, content]) => content!.intro);
    expect(new Set(intros).size).toBe(intros.length);
  });
});

describe("giftIdeasCountLabel", () => {
  const withCount = (count: number) => ({ title: "", intro: "", avoid: [], groups: [{ title: "", ideas: Array.from({ length: count }, (_, i) => ({ name: `${i}`, why: "", price: "", query: "" })) }] });

  test.each([[1, "1 идея"], [3, "3 идеи"], [12, "12 идей"], [14, "14 идей"], [21, "21 идея"], [22, "22 идеи"]])("%i → %s", (count, label) => {
    expect(countGiftIdeas(withCount(count))).toBe(count);
    expect(giftIdeasCountLabel(withCount(count))).toBe(label);
  });
});

test("search links encode the query for each store", () => {
  const links = giftIdeaSearchLinks("плед & чай");
  expect(links.map((link) => link.store)).toEqual(["Ozon", "Wildberries", "Яндекс Маркет"]);
  for (const link of links) expect(link.href).toContain(encodeURIComponent("плед & чай"));
});

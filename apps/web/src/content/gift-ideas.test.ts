import { describe, expect, test } from "vitest";
import { GIFT_IDEAS, countGiftIdeas, giftIdeaSearchLinks, giftIdeasCountLabel } from "./gift-ideas";

describe("gift ideas content", () => {
  const pages = Object.entries(GIFT_IDEAS);

  test("covers the most searched gift pages", () => {
    expect(Object.keys(GIFT_IDEAS).sort()).toEqual(["for-boyfriend", "for-dad", "for-girlfriend", "for-mom", "new-year", "under-3000"]);
  });

  test.each(pages)("%s has at least ten complete ideas with unique names", (_slug, content) => {
    const ideas = content!.groups.flatMap((group) => group.ideas);
    expect(ideas.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ideas.map((idea) => idea.name)).size).toBe(ideas.length);
    for (const idea of ideas) {
      expect(idea.why.length).toBeGreaterThan(10);
      expect(idea.query.trim()).not.toBe("");
      expect(idea.price).toMatch(/₽$/);
    }
    expect(content!.avoid.length).toBeGreaterThan(0);
  });

  test("ideas on the 3 000 ₽ page stay within the budget", () => {
    const ideas = GIFT_IDEAS["under-3000"]!.groups.flatMap((group) => group.ideas);
    for (const idea of ideas) {
      const upper = Number(idea.price.replace(/\s/g, "").match(/(\d+)₽$/)?.[1]);
      expect(upper).toBeLessThanOrEqual(3000);
    }
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

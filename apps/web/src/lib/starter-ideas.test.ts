import { describe, expect, it } from "vitest";
import { GIFT_IDEAS } from "@/content/gift-ideas";
import { starterIdeas } from "./starter-ideas";

describe("starterIdeas", () => {
  it("takes the first idea of each group first", () => {
    const groups = GIFT_IDEAS["new-year"]!.groups;
    const ideas = starterIdeas("new_year", []);
    expect(ideas).toHaveLength(4);
    expect(ideas[0]!.name).toBe(groups[0]!.ideas[0]!.name);
    expect(ideas[1]!.name).toBe(groups[1]!.ideas[0]!.name);
  });

  it("skips ideas already in the list, ignoring case", () => {
    const first = starterIdeas("birthday", [])[0]!.name;
    expect(starterIdeas("birthday", [` ${first.toUpperCase()} `]).map((idea) => idea.name)).not.toContain(first);
  });

  it("falls back to birthday ideas for other occasions", () => {
    expect(starterIdeas("other", [])).toEqual(starterIdeas("birthday", []));
  });
});

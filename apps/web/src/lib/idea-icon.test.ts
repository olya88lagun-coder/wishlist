import { describe, expect, it } from "vitest";
import { GIFT_IDEAS } from "@/content/gift-ideas";
import { ideaIcon } from "./idea-icon";

describe("ideaIcon", () => {
  it.each([
    ["Кофемашина с капучинатором", "kitchen"],
    ["Красивая кружка и её любимый чай или кофе", "drink"],
    ["Билеты на концерт или спектакль", "ticket"],
    ["Книга любимого автора в красивом издании", "book"],
    ["Беспроводные наушники", "tech"],
    ["Коврик для йоги и фитнеса", "sport"],
    ["Ароматическая свеча", "home"],
    ["Что-то совсем другое", "gift"],
    ["Подарок для новой квартиры", "gift"],
    ["Настольная игра", "game"],
    ["Фотокнига итогов года", "photo"],
    ["Увлажнитель воздуха", "home"],
    ["Санки или ватрушка", "sport"],
  ])("%s → %s", (name, icon) => {
    expect(ideaIcon({ name })).toBe(icon);
  });

  it("gives most catalogue ideas a specific icon", () => {
    const ideas = Object.values(GIFT_IDEAS).flatMap((content) => content!.groups.flatMap((group) => group.ideas));
    const generic = ideas.filter((idea) => ideaIcon(idea) === "gift").length;
    expect(generic / ideas.length).toBeLessThan(0.3);
  });
});

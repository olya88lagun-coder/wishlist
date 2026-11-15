import { GIFT_IDEAS, type GiftIdea } from "@/content/gift-ideas";

const SOURCE: Record<string, string> = { birthday: "birthday", new_year: "new-year", other: "birthday" };

// Идеи для быстрого старта пустого списка: по одной из каждой группы подборки повода, без уже добавленных
export function starterIdeas(occasion: string, existingTitles: readonly string[], limit = 4): GiftIdea[] {
  const content = GIFT_IDEAS[SOURCE[occasion] ?? "birthday"];
  if (!content) return [];
  const taken = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
  const rounds = Math.max(...content.groups.map((group) => group.ideas.length));
  const picked: GiftIdea[] = [];
  for (let round = 0; round < rounds && picked.length < limit; round++) {
    for (const group of content.groups) {
      const idea = group.ideas[round];
      if (idea && !taken.has(idea.name.trim().toLowerCase()) && picked.length < limit) picked.push(idea);
    }
  }
  return picked;
}

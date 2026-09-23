import { BUDGET_GIFT_IDEAS } from "./budget";
import { CORE_GIFT_IDEAS } from "./core";
import { FAMILY_GIFT_IDEAS } from "./family";
import { OCCASION_GIFT_IDEAS } from "./occasions";
import { PEOPLE_GIFT_IDEAS } from "./people";
import type { GiftIdeasContent } from "./types";

export type { GiftIdea, GiftIdeaGroup, GiftIdeasContent } from "./types";

export const GIFT_IDEAS: Partial<Record<string, GiftIdeasContent>> = {
  ...CORE_GIFT_IDEAS,
  ...FAMILY_GIFT_IDEAS,
  ...PEOPLE_GIFT_IDEAS,
  ...OCCASION_GIFT_IDEAS,
  ...BUDGET_GIFT_IDEAS,
};

export function countGiftIdeas(content: GiftIdeasContent): number {
  return content.groups.reduce((total, group) => total + group.ideas.length, 0);
}

// «21 идея», «12 идей», «3 идеи»
export function giftIdeasCountLabel(content: GiftIdeasContent): string {
  const count = countGiftIdeas(content);
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "идея" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "идеи" : "идей";
  return `${count} ${word}`;
}

export function giftIdeaSearchLinks(query: string) {
  const text = encodeURIComponent(query);
  return [
    { store: "Ozon", href: `https://www.ozon.ru/search/?text=${text}` },
    { store: "Wildberries", href: `https://www.wildberries.ru/catalog/0/search.aspx?search=${text}` },
    { store: "Яндекс Маркет", href: `https://market.yandex.ru/search?text=${text}` },
  ];
}

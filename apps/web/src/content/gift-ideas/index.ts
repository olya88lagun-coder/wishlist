import { BUDGET_GIFT_IDEAS } from "./budget";
import { CORE_GIFT_IDEAS } from "./core";
import { FAMILY_GIFT_IDEAS } from "./family";
import { OCCASION_GIFT_IDEAS } from "./occasions";
import { PEOPLE_GIFT_IDEAS } from "./people";
import { SEARCH_STORES, STORE_LABELS, storeSearchHref } from "@/app/go/store-search";
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

export function giftIdeaSearchLinks(query: string, source: string) {
  return SEARCH_STORES.map((store) => ({
    store: STORE_LABELS[store] ?? store,
    href: storeSearchHref(store, query, source),
  }));
}

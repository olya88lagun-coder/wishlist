// Конкретные идеи подарков для страниц /gifts/*. Цены — ориентир по крупным
// маркетплейсам, а не обещание: поиск открывает актуальные предложения магазина.

export type GiftIdea = {
  name: string;
  why: string;
  price: string;
  query: string;
};

export type GiftIdeaGroup = {
  title: string;
  ideas: GiftIdea[];
};

export type GiftIdeasContent = {
  title: string;
  intro: string;
  groups: GiftIdeaGroup[];
  avoid: string[];
};

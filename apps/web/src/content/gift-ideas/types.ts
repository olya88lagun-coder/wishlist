// Конкретные идеи подарков для страниц /gifts/*. Цены — примерные диапазоны
// для планирования бюджета; актуальные условия нужно проверять у продавца.

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

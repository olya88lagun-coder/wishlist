// Какие дополнительные магазины предлагать к идее подарка. Три основных (Ozon, Wildberries, Яндекс Маркет) показываем всегда,
// чтобы можно было сравнить цены; дополнительные подбираем по типу вещи, а не по размеру комиссии.
export type ExtraStore = "chitaigorod" | "lamoda" | "aliexpress";
export const EXTRA_STORES: readonly ExtraStore[] = ["chitaigorod", "lamoda", "aliexpress"];

export type IdeaForRouting = { name: string; query: string; price?: string; budget?: number };

const MAX_EXTRA_STORES = 2;
const LAMODA_MIN_PRICE = 500;
const ALIEXPRESS_MAX_PRICE = 1500;

// Основы слов: токен подходит, если начинается с основы (учитывает падежи). Фраза — несколько слов подряд.
const BOOK_TERMS = [
  ["книг"], ["роман"], ["комикс"], ["манг"], ["энциклопед"], ["раскраск"], ["ежедневник"], ["блокнот"], ["пазл"], ["канцеляр"],
  ["настольн", "игр"],
];
const FASHION_TERMS = [
  ["плать"], ["юбк"], ["блуз"], ["рубашк"], ["футболк"], ["свитер"], ["кардиган"], ["джемпер"], ["худи"], ["толстовк"],
  ["джинс"], ["брюк"], ["пальто"], ["куртк"], ["пуховик"], ["кроссовк"], ["ботинк"], ["туфл"], ["сапог"], ["сумк"], ["рюкзак"],
  ["шарф"], ["перчатк"], ["ремень"], ["ремн"], ["кошелек"], ["очки"], ["шапк"], ["пижам"], ["халат"],
];

function tokens(text: string): string[] {
  return text.toLowerCase().replaceAll("ё", "е").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function hasTerm(words: readonly string[], terms: readonly (readonly string[])[]): boolean {
  return terms.some((term) => words.some((_, start) => term.every((stem, offset) => words[start + offset]?.startsWith(stem))));
}

// «1 500–5 000 ₽» → { min: 1500, max: 5000 }; «от 2 000 ₽» → { min: 2000, max: null }
export function priceRange(price: string): { min: number; max: number | null } | null {
  const numbers = (price.replace(/[\s  ]/g, "").match(/\d+/g) ?? []).map(Number);
  const [first] = numbers;
  if (first === undefined) return null;
  if (numbers.length === 1) return { min: first, max: /^от/i.test(price.trim()) ? null : first };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

export function extraStoresForIdea(idea: IdeaForRouting, enabled: readonly ExtraStore[]): ExtraStore[] {
  const words = tokens(`${idea.name} ${idea.query}`);
  const range = idea.price ? priceRange(idea.price) : null;
  const picked: ExtraStore[] = [];

  const isBookIdea = hasTerm(words, BOOK_TERMS);
  if (isBookIdea) picked.push("chitaigorod");
  if (hasTerm(words, FASHION_TERMS) && !(range && range.min < LAMODA_MIN_PRICE)) picked.push("lamoda");
  const upper: number | null = range ? range.max : (idea.budget ?? null);
  // Книги и игры из книжного магазина на AliExpress не ищем: выбор и сроки там хуже
  if (!isBookIdea && upper !== null && upper <= ALIEXPRESS_MAX_PRICE) picked.push("aliexpress");

  return picked.filter((store) => enabled.includes(store)).slice(0, MAX_EXTRA_STORES);
}

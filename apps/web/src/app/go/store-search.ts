// Поиск по магазину строится на сервере из белого списка: снаружи приходит только текст запроса,
// поэтому увести человека на произвольный адрес через этот редирект нельзя.
const STORE_SEARCH: Record<string, (query: string) => string> = {
  ozon: (q) => `https://www.ozon.ru/search/?text=${q}`,
  wildberries: (q) => `https://www.wildberries.ru/catalog/0/search.aspx?search=${q}`,
  yandex_market: (q) => `https://market.yandex.ru/search?text=${q}`,
  // Дополнительные магазины: показываются только к подходящим идеям и когда для них задан партнёрский шаблон
  chitaigorod: (q) => `https://www.chitai-gorod.ru/search?phrase=${q}`,
  lamoda: (q) => `https://www.lamoda.ru/catalogsearch/result/?q=${q}`,
  aliexpress: (q) => `https://aliexpress.ru/wholesale?SearchText=${q}`,
};

// Три основных магазина показываем всегда; дополнительные — см. store-routing.ts
export const SEARCH_STORES = ["ozon", "wildberries", "yandex_market"];

export const STORE_LABELS: Record<string, string> = {
  ozon: "Ozon",
  wildberries: "Wildberries",
  yandex_market: "Яндекс Маркет",
  chitaigorod: "Читай-город",
  lamoda: "Lamoda",
  aliexpress: "AliExpress",
};

export function isSearchStore(store: string): boolean {
  return store in STORE_SEARCH;
}

export function storeSearchUrl(store: string, query: string): string | null {
  const build = STORE_SEARCH[store];
  const text = query.trim();
  if (!build || !text) return null;
  return build(encodeURIComponent(text));
}

// Адрес перехода: сам поиск остаётся видимым в ссылке, чтобы человек понимал, куда идёт
export function storeSearchHref(store: string, query: string, source: string): string {
  const params = new URLSearchParams({ store, q: query, from: source });
  return `/go/search?${params.toString()}`;
}

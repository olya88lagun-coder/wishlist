// Поиск по магазину строится на сервере из белого списка: снаружи приходит только текст запроса,
// поэтому увести человека на произвольный адрес через этот редирект нельзя.
const STORE_SEARCH: Record<string, (query: string) => string> = {
  ozon: (q) => `https://www.ozon.ru/search/?text=${q}`,
  wildberries: (q) => `https://www.wildberries.ru/catalog/0/search.aspx?search=${q}`,
  yandex_market: (q) => `https://market.yandex.ru/search?text=${q}`,
};

export const SEARCH_STORES = Object.keys(STORE_SEARCH);

export const STORE_LABELS: Record<string, string> = {
  ozon: "Ozon",
  wildberries: "Wildberries",
  yandex_market: "Яндекс Маркет",
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

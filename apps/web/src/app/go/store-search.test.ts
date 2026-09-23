import { expect, test } from "vitest";
import { searchCookieName } from "./go-cookie";
import { SEARCH_STORES, STORE_LABELS, isSearchStore, storeSearchHref, storeSearchUrl } from "./store-search";

test("knows exactly the three stores we send people to", () => {
  expect(SEARCH_STORES).toEqual(["ozon", "wildberries", "yandex_market"]);
  for (const store of SEARCH_STORES) expect(STORE_LABELS[store]).toBeTruthy();
});

test("builds a search url per store and escapes the query", () => {
  expect(storeSearchUrl("ozon", "плед & чай")).toBe("https://www.ozon.ru/search/?text=%D0%BF%D0%BB%D0%B5%D0%B4%20%26%20%D1%87%D0%B0%D0%B9");
  expect(storeSearchUrl("wildberries", "термокружка")).toContain("wildberries.ru/catalog/0/search.aspx?search=");
  expect(storeSearchUrl("yandex_market", "термокружка")).toContain("market.yandex.ru/search?text=");
});

test("refuses unknown stores and empty queries", () => {
  expect(isSearchStore("avito")).toBe(false);
  expect(storeSearchUrl("avito", "подарок")).toBeNull();
  expect(storeSearchUrl("ozon", "   ")).toBeNull();
});

// Адрес приходит от пользователя только как текст запроса, поэтому подставить чужой домен нельзя
test("a query that looks like a url still ends up inside the store search", () => {
  const url = storeSearchUrl("ozon", "https://evil.example/steal");
  expect(url?.startsWith("https://www.ozon.ru/search/?text=")).toBe(true);
  expect(url).not.toContain("evil.example/steal");
});

test("href points at the redirect and carries the source page", () => {
  const url = new URL(storeSearchHref("ozon", "плед", "gifts/for-mom"), "https://my-wish-list.online");
  expect(url.pathname).toBe("/go/search");
  expect(url.searchParams.get("store")).toBe("ozon");
  expect(url.searchParams.get("q")).toBe("плед");
  expect(url.searchParams.get("from")).toBe("gifts/for-mom");
});

test("cookie name is stable per store and query, and hides the query", () => {
  const name = searchCookieName("ozon", "Плед из хлопка");
  expect(name).toMatch(/^wl_gs_[0-9a-f]{12}$/);
  expect(searchCookieName("ozon", "плед из хлопка")).toBe(name);
  expect(searchCookieName("wildberries", "Плед из хлопка")).not.toBe(name);
});

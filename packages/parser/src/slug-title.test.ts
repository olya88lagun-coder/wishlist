import { expect, test } from "vitest";
import { titleFromUrlSlug } from "./slug-title";

test("builds a readable title from Ozon and Lamoda slugs", () => {
  expect(titleFromUrlSlug("https://www.ozon.ru/product/dyuna-frenk-gerbert-1234567/", "ozon")).toBe("Dyuna frenk gerbert");
  expect(titleFromUrlSlug("https://www.ozon.ru/product/nabor-kistey-12-sht-987654321", "ozon")).toBe("Nabor kistey sht");
  expect(titleFromUrlSlug("https://www.lamoda.ru/p/rtlacv500701/clothes-mango-futbolka/", "lamoda")).toBe("Clothes mango futbolka");
});

test("returns null when the URL carries no usable slug", () => {
  expect(titleFromUrlSlug("https://ozon.ru/t/AbC12", "ozon")).toBeNull();
  expect(titleFromUrlSlug("https://www.ozon.ru/product/123456789/", "ozon")).toBeNull();
  expect(titleFromUrlSlug("https://www.wildberries.ru/catalog/1/detail.aspx", "wildberries")).toBeNull();
});

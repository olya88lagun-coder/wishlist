import { describe, expect, test } from "vitest";
import { detectStore, normalizeProductUrl } from "./store";

describe("normalizeProductUrl", () => {
  test("strips tracking params and hash, lowercases host", () => {
    expect(
      normalizeProductUrl("https://WWW.Wildberries.ru/catalog/173937886/detail.aspx?utm_source=tg&size=42&fbclid=x#reviews"),
    ).toBe("https://www.wildberries.ru/catalog/173937886/detail.aspx?size=42");
  });

  test("trims whitespace and accepts http", () => {
    expect(normalizeProductUrl("  http://lamoda.ru/p/abc/  ")).toBe("http://lamoda.ru/p/abc/");
  });

  test("rejects non-http schemes, garbage and very long urls", () => {
    expect(normalizeProductUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeProductUrl("ftp://example.com/a")).toBeNull();
    expect(normalizeProductUrl("просто текст")).toBeNull();
    expect(normalizeProductUrl(`https://example.com/${"a".repeat(2100)}`)).toBeNull();
  });
});

describe("detectStore", () => {
  test.each([
    ["https://www.wildberries.ru/catalog/1/detail.aspx", "wildberries", "Wildberries"],
    ["https://aliexpress.ru/item/1005001234567890.html", "aliexpress", "AliExpress"],
    ["https://www.aliexpress.com/item/1005001234567890.html", "aliexpress", "AliExpress"],
    ["https://www.chitai-gorod.ru/product/kniga-1234567", "chitaigorod", "Читай-город"],
    ["https://wb.ru/catalog/1/detail.aspx", "wildberries", "Wildberries"],
    ["https://www.ozon.ru/product/x-1/", "ozon", "Ozon"],
    ["https://goldapple.ru/19000238593-search", "goldapple", "Золотое Яблоко"],
    ["https://www.lamoda.ru/p/rtlabq944601/", "lamoda", "Lamoda"],
    ["https://market.yandex.ru/product--x/1", "yandex_market", "Яндекс Маркет"],
    ["https://tefal.ru/category/posuda", "tefal", "Tefal"],
    ["https://www.krups.ru/collection/kofemolki", "krups", "KRUPS"],
    ["https://www.sportmaster.ru/product/12345/", "sportmaster", "Спортмастер"],
    ["https://shop.mts.ru/product/smartfon-1/", "mts", "МТС Shop"],
    ["https://de-parfum.ru/catalog/podarki/", "deparfum", "Де-Парфюм"],
    ["https://www.de-parfum.ru/catalog/product/1287-light-blue-pour-femme/", "deparfum", "Де-Парфюм"],
    ["https://www.shop.mts.ru/catalog/smartfony/", "mts", "МТС Shop"],
  ])("%s → %s", (url, id, label) => {
    expect(detectStore(url)).toEqual({ id, label });
  });

  test("falls back to the bare host for unknown shops", () => {
    expect(detectStore("https://www.letu.ru/product/1")).toEqual({ id: "other", label: "letu.ru" });
  });
});

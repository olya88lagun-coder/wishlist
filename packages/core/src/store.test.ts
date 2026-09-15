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
    ["https://wb.ru/catalog/1/detail.aspx", "wildberries", "Wildberries"],
    ["https://www.ozon.ru/product/x-1/", "ozon", "Ozon"],
    ["https://goldapple.ru/19000238593-search", "goldapple", "Золотое Яблоко"],
    ["https://www.lamoda.ru/p/rtlabq944601/", "lamoda", "Lamoda"],
    ["https://market.yandex.ru/product--x/1", "yandex_market", "Яндекс Маркет"],
  ])("%s → %s", (url, id, label) => {
    expect(detectStore(url)).toEqual({ id, label });
  });

  test("falls back to the bare host for unknown shops", () => {
    expect(detectStore("https://www.letu.ru/product/1")).toEqual({ id: "other", label: "letu.ru" });
  });
});

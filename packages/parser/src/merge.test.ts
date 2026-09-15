import { describe, expect, test } from "vitest";
import { mergeProduct, statusFor, TITLE_MAX } from "./merge";

const PAGE = "https://goldapple.ru/19000180719-lip-mask";

describe("mergeProduct", () => {
  test("takes the first non-empty value per field in source order", () => {
    expect(
      mergeProduct(PAGE, [
        { title: "Из JSON-LD", priceKopecks: null, imageUrl: null },
        { title: null, priceKopecks: 135000, currency: "RUB" },
        { title: "Из OG", description: "Описание", imageUrl: "/media/p.jpg", priceKopecks: 999900 },
      ]),
    ).toEqual({
      title: "Из JSON-LD",
      description: "Описание",
      imageUrl: "https://goldapple.ru/media/p.jpg",
      priceKopecks: 135000,
      currency: "RUB",
    });
  });

  test("collapses whitespace, trims and cuts long text", () => {
    const merged = mergeProduct(PAGE, [{ title: `  Очень\n\n длинное ${"слово ".repeat(80)}` }]);
    expect(merged.title?.startsWith("Очень длинное слово")).toBe(true);
    expect(merged.title?.length).toBe(TITLE_MAX);
    expect(merged.title?.endsWith("…")).toBe(true);
  });

  test("drops non-http images and prices in foreign currency", () => {
    expect(mergeProduct(PAGE, [{ title: "Духи", imageUrl: "data:image/png;base64,AAAA", priceKopecks: 5000, currency: "USD" }])).toEqual({
      title: "Духи",
      description: null,
      imageUrl: null,
      priceKopecks: null,
      currency: null,
    });
  });

  test("drops the stock prefix some stores put before the title", () => {
    expect(mergeProduct(PAGE, [{ title: "В наличии: Парфюмерная вода EPC" }]).title).toBe("Парфюмерная вода EPC");
    expect(mergeProduct(PAGE, [{ title: "Нет в наличии: Помада" }]).title).toBe("Помада");
  });

  test("treats RUR as roubles", () => {
    expect(mergeProduct(PAGE, [{ title: "Духи", priceKopecks: 5000, currency: "RUR" }]).priceKopecks).toBe(5000);
  });
});

describe("statusFor", () => {
  test("ok needs a title and a price; the photo does not matter", () => {
    expect(statusFor({ title: "Свеча", priceKopecks: 99000 })).toBe("ok");
    expect(statusFor({ title: "Свеча", priceKopecks: null })).toBe("partial");
    expect(statusFor({ title: null, priceKopecks: 99000 })).toBe("failed");
  });
});

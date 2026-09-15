import { describe, expect, test } from "vitest";
import { toCardModel } from "./item-card-model";

describe("toCardModel", () => {
  test("formats price, detects store and builds a monogram", () => {
    expect(
      toCardModel({ title: "наушники Sony", sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx", priceKopecks: 2499000, note: "чёрные", isMustHave: true }),
    ).toEqual({
      title: "наушники Sony",
      priceText: "24 990 ₽",
      storeLabel: "Wildberries",
      monogram: "Н",
      note: "чёрные",
      isMustHave: true,
      href: "https://www.wildberries.ru/catalog/1/detail.aspx",
    });
  });

  test("works without link and price", () => {
    expect(toCardModel({ title: "  сертификат", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false })).toMatchObject({
      priceText: null,
      storeLabel: null,
      monogram: "С",
      href: null,
    });
  });
});

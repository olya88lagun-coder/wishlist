import { describe, expect, test } from "vitest";
import { toCardModel } from "./item-card-model";

describe("toCardModel", () => {
  test("formats price, detects store and builds a monogram", () => {
    expect(
      toCardModel({
        title: "наушники Sony",
        sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx",
        priceKopecks: 2499000,
        note: "чёрные",
        isMustHave: true,
        imageUrl: "https://s3.twcstorage.ru/wishlist-images/items/1/a.webp",
        parseStatus: "ok",
      }),
    ).toEqual({
      title: "наушники Sony",
      priceText: "24 990 ₽",
      storeLabel: "Wildberries",
      monogram: "Н",
      note: "чёрные",
      isMustHave: true,
      href: "https://www.wildberries.ru/catalog/1/detail.aspx",
      imageUrl: "https://s3.twcstorage.ru/wishlist-images/items/1/a.webp",
      pending: false,
    });
  });

  test("works without link, price, photo and status", () => {
    expect(toCardModel({ title: "  сертификат", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false })).toMatchObject({
      priceText: null,
      storeLabel: null,
      monogram: "С",
      href: null,
      imageUrl: null,
      pending: false,
    });
  });

  test("an item still being parsed shows a loading title and the store monogram", () => {
    expect(
      toCardModel({ title: "", sourceUrl: "https://goldapple.ru/19000180719-lip-mask", priceKopecks: null, note: null, isMustHave: false, parseStatus: "pending" }),
    ).toMatchObject({ title: "Загружаем данные…", monogram: "З", storeLabel: "Золотое Яблоко", pending: true });
  });

  test("an item the store gave nothing for is named by its store", () => {
    expect(
      toCardModel({ title: "", sourceUrl: "https://www.ozon.ru/t/abc", priceKopecks: null, note: null, isMustHave: false, parseStatus: "failed" }),
    ).toMatchObject({ title: "Подарок из Ozon", monogram: "O", pending: false });
  });
});

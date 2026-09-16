import { expect, test } from "vitest";
import { extractLinks, MAX_LINKS_PER_MESSAGE } from "./links";

test("takes links from Telegram entities, including text links and links without a scheme", () => {
  const text = "Хочу вот это wb.ru/catalog/1/detail.aspx и ещё";
  expect(
    extractLinks(text, [
      { type: "url", offset: 13, length: 27 },
      { type: "text_link", offset: 43, length: 3, url: "https://goldapple.ru/19000378828-cardamom-moss?utm_source=tg" },
    ]),
  ).toEqual(["https://wb.ru/catalog/1/detail.aspx", "https://goldapple.ru/19000378828-cardamom-moss"]);
});

test("falls back to searching the text and trims trailing punctuation", () => {
  expect(extractLinks("Смотри: https://www.ozon.ru/product/igrushka-123456/.")).toEqual(["https://www.ozon.ru/product/igrushka-123456/"]);
  expect(extractLinks("(https://market.yandex.ru/cc/B4wQYn)")).toEqual(["https://market.yandex.ru/cc/B4wQYn"]);
});

test("deduplicates, ignores non-http links and caps the count", () => {
  const many = Array.from({ length: 8 }, (_, i) => `https://shop.ru/p/${i}`).join(" ");
  expect(extractLinks(many)).toHaveLength(MAX_LINKS_PER_MESSAGE);
  expect(extractLinks("https://shop.ru/p/1 https://shop.ru/p/1#reviews")).toEqual(["https://shop.ru/p/1"]);
  expect(extractLinks("просто текст без ссылок, tg://resolve?domain=x")).toEqual([]);
});

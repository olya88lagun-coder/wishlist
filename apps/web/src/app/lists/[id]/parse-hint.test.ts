import { expect, test } from "vitest";
import { parseHint } from "./parse-hint";

const base = { title: "Наушники", priceKopecks: 199000, sourceUrl: "https://market.yandex.ru/product--x/1" };

test("asks only for what the store did not give", () => {
  expect(parseHint({ ...base, parseStatus: "partial", priceKopecks: null })).toBe("Яндекс Маркет не отдал цену — впишите её");
  expect(parseHint({ ...base, parseStatus: "failed", title: "", priceKopecks: null })).toBe("Яндекс Маркет не отдал данные — впишите название и цену");
  expect(parseHint({ ...base, parseStatus: "failed", title: "", sourceUrl: null })).toBe("Магазин не отдал данные — впишите название");
});

test("explains Ozon short links instead of blaming the store", () => {
  expect(parseHint({ parseStatus: "failed", title: "", priceKopecks: null, sourceUrl: "https://ozon.ru/t/zLwPTmL" })).toBe(
    "Ozon не открывает короткие ссылки — вставьте полную ссылку на товар или впишите название",
  );
});

test("no hint for complete, pending or manual items", () => {
  expect(parseHint({ ...base, parseStatus: "ok" })).toBeNull();
  expect(parseHint({ ...base, parseStatus: "pending", title: "" })).toBeNull();
  expect(parseHint({ ...base, parseStatus: "partial" })).toBeNull();
});

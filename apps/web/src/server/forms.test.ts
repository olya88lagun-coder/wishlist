import { describe, expect, test } from "vitest";
import { parseItemForm, parseWishlistForm } from "./forms";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("parseWishlistForm", () => {
  test("accepts a birthday list with a date", () => {
    expect(parseWishlistForm(form({ title: "  Маше 30 ", occasion: "birthday", eventDate: "2026-03-14" }))).toEqual({
      ok: true,
      value: { title: "Маше 30", occasion: "birthday", eventDate: "2026-03-14" },
    });
  });

  test("treats an empty date as no date", () => {
    expect(parseWishlistForm(form({ title: "Идеи", occasion: "other", eventDate: "" }))).toMatchObject({ ok: true, value: { eventDate: null } });
  });

  test("reports field errors in Russian", () => {
    const result = parseWishlistForm(form({ title: " ", occasion: "wedding", eventDate: "2026-02-30" }));
    expect(result).toEqual({
      ok: false,
      errors: { title: "Введите название списка", occasion: "Выберите повод", eventDate: "Проверьте дату" },
    });
  });

  test("limits title length", () => {
    expect(parseWishlistForm(form({ title: "я".repeat(81), occasion: "other", eventDate: "" }))).toMatchObject({
      ok: false,
      errors: { title: "Название длиннее 80 символов" },
    });
  });
});

describe("parseItemForm", () => {
  test("normalizes the link, parses the price and reads the checkbox", () => {
    expect(
      parseItemForm(form({ title: "Наушники", url: " https://www.wildberries.ru/catalog/1/detail.aspx?utm_source=x ", price: "24 990", note: "чёрные", isMustHave: "on" })),
    ).toEqual({
      ok: true,
      value: { title: "Наушники", sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx", priceKopecks: 2499000, note: "чёрные", isMustHave: true },
    });
  });

  test("optional fields may be empty", () => {
    expect(parseItemForm(form({ title: "Сертификат", url: "", price: "", note: "" }))).toEqual({
      ok: true,
      value: { title: "Сертификат", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false },
    });
  });

  test("reports invalid link and price; a broken link alone does not require a title", () => {
    expect(parseItemForm(form({ title: "", url: "javascript:alert(1)", price: "дорого", note: "" }))).toEqual({
      ok: false,
      errors: { url: "Ссылка должна начинаться с https://", price: "Цена — число в рублях, например 2 490" },
    });
  });

  test("needs either a link or a title", () => {
    expect(parseItemForm(form({ title: "", url: "", price: "", note: "" }))).toEqual({
      ok: false,
      errors: { title: "Вставьте ссылку или напишите название" },
    });
  });

  test("a link alone is enough — the rest comes from the store", () => {
    expect(parseItemForm(form({ url: "https://www.wildberries.ru/catalog/173937886/detail.aspx?utm_source=tg" }))).toEqual({
      ok: true,
      value: { title: "", sourceUrl: "https://www.wildberries.ru/catalog/173937886/detail.aspx", priceKopecks: null, note: null, isMustHave: false },
    });
  });
});

import { describe, expect, test } from "vitest";
import { extraStoresForIdea, priceRange } from "./store-routing";

const ALL = ["chitaigorod", "lamoda", "aliexpress"] as const;

describe("priceRange", () => {
  test("reads ranges with thin and no-break spaces", () => {
    expect(priceRange("1 500–5 000 ₽")).toEqual({ min: 1500, max: 5000 });
    expect(priceRange("500–1 500 ₽")).toEqual({ min: 500, max: 1500 });
  });

  test("open ranges and single prices", () => {
    expect(priceRange("от 2 000 ₽")).toEqual({ min: 2000, max: null });
    expect(priceRange("800 ₽")).toEqual({ min: 800, max: 800 });
    expect(priceRange("по договорённости")).toBeNull();
  });
});

describe("extraStoresForIdea", () => {
  test("sends books and games to Читай-город", () => {
    expect(extraStoresForIdea({ name: "Книга-рецепты", query: "книга рецептов подарочная" }, ALL)).toContain("chitaigorod");
    expect(extraStoresForIdea({ name: "Настольная игра для компании", query: "настольная игра" }, ALL)).toContain("chitaigorod");
  });

  test("does not treat a photo book as a bookstore item", () => {
    expect(extraStoresForIdea({ name: "Фотокнига с семейными снимками", query: "фотокнига" }, ALL)).not.toContain("chitaigorod");
  });

  test("sends clothes and bags to Lamoda, but only from 500 rubles", () => {
    expect(extraStoresForIdea({ name: "Шарф из шерсти", query: "шарф женский", price: "1 500–3 000 ₽" }, ALL)).toContain("lamoda");
    expect(extraStoresForIdea({ name: "Шарф", query: "шарф", price: "300–450 ₽" }, ALL)).not.toContain("lamoda");
    expect(extraStoresForIdea({ name: "Рюкзак для ноутбука", query: "рюкзак" }, ALL)).toContain("lamoda");
  });

  test("sends cheap ideas to AliExpress and keeps expensive ones away", () => {
    expect(extraStoresForIdea({ name: "Термокружка", query: "термокружка", price: "500–1 500 ₽" }, ALL)).toContain("aliexpress");
    expect(extraStoresForIdea({ name: "Робот-пылесос", query: "робот пылесос", price: "15 000–30 000 ₽" }, ALL)).not.toContain("aliexpress");
    expect(extraStoresForIdea({ name: "Что-то", query: "что-то" }, ALL)).not.toContain("aliexpress");
  });

  test("uses the finder budget when an idea has no price", () => {
    expect(extraStoresForIdea({ name: "Подарок", query: "подарок для мамы", budget: 1000 }, ALL)).toContain("aliexpress");
    expect(extraStoresForIdea({ name: "Подарок", query: "подарок для мамы", budget: 10000 }, ALL)).not.toContain("aliexpress");
  });

  test("returns only enabled stores and at most two", () => {
    expect(extraStoresForIdea({ name: "Книга", query: "книга" }, ["lamoda", "aliexpress"])).toEqual([]);
    const many = extraStoresForIdea({ name: "Книга-раскраска", query: "книга раскраска", price: "500–900 ₽" }, ALL);
    expect(many.length).toBeLessThanOrEqual(2);
    expect(many[0]).toBe("chitaigorod");
  });
});

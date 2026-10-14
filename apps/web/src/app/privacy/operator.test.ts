import { expect, test } from "vitest";
import { COLLECTED_DATA, OPERATOR, PRIVACY_UPDATED_AT, THIRD_PARTIES } from "./operator";

test("operator details are filled in", () => {
  expect(OPERATOR.name.trim().split(" ").length).toBeGreaterThanOrEqual(2);
  expect(OPERATOR.inn).toMatch(/^\d{12}$/);
  expect(OPERATOR.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  expect(PRIVACY_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("the policy lists everything the service actually stores", () => {
  const listed = COLLECTED_DATA.map((row) => row.what).join(" | ");
  for (const data of ["Имя и фото профиля Telegram", "Идентификатор Telegram", "VK ID", "Имя гостя", "Cookie", "Ссылки на товары"]) {
    expect(listed).toContain(data);
  }
  expect(COLLECTED_DATA.every((row) => row.why.length > 10 && row.where.length > 3)).toBe(true);
});

test("the policy names the third parties that receive data", () => {
  const listed = COLLECTED_DATA.map((row) => row.what).join(" | ");
  for (const data of ["Яндекс Метрика", "Текст запроса к AI-подбору", "Переходы по ссылкам в магазины"]) {
    expect(listed).toContain(data);
  }
  expect(THIRD_PARTIES.map((party) => party.name)).toEqual(expect.arrayContaining(["Яндекс Метрика", "RouterAI", "Партнёрские сети и магазины"]));
  expect(THIRD_PARTIES.every((party) => party.what.length > 10 && party.why.length > 10)).toBe(true);
});

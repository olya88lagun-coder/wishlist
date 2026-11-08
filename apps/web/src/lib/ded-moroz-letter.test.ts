import { expect, test } from "vitest";
import { dedMorozLetterSchema, dedMorozLetterText } from "./ded-moroz-letter";

test("young girl: gendered forms, achievements joined and inlined, gift mentioned", () => {
  const letter = dedMorozLetterText({ name: "Маша", gender: "girl", age: "4", achievements: ["Научилась кататься на велосипеде", "пошла в садик", ""], gift: "самокат" });
  expect(letter.greeting).toBe("Дорогая Маша!");
  expect(letter.paragraphs[0]).toContain("росла смелой и доброй");
  expect(letter.paragraphs[1]).toBe("Я знаю, что в этом году ты научилась кататься на велосипеде и пошла в садик. Я очень тобой горжусь!");
  expect(letter.paragraphs[2]).toContain("главное желание: самокат.");
  expect(letter.paragraphs).toHaveLength(4);
});

test("age picks the template; empty optional fields fall back to default phrases", () => {
  const middle = dedMorozLetterText({ name: "Миша", gender: "boy", age: "7" });
  expect(middle.greeting).toBe("Здравствуй, дорогой Миша!");
  expect(middle.paragraphs[1]).toContain("видел, как ты старался");
  const older = dedMorozLetterText({ name: "Аня", gender: "girl", age: "12", wish: "Не грусти" });
  expect(older.paragraphs[0]).toContain("совсем взрослая");
  expect(older.paragraphs[1]).toContain("сделала сама");
  expect(older.paragraphs[3]).toBe("Не грусти.");
});

test("schema rejects bad input", () => {
  expect(dedMorozLetterSchema.safeParse({ name: "", gender: "boy", age: "5" }).success).toBe(false);
  expect(dedMorozLetterSchema.safeParse({ name: "Миша", gender: "boy", age: "18" }).success).toBe(false);
  expect(dedMorozLetterSchema.safeParse({ name: "Миша", gender: "x", age: "5" }).success).toBe(false);
  expect(dedMorozLetterSchema.safeParse({ name: "Ми\nша", gender: "boy", age: "5" }).success).toBe(false);
  expect(dedMorozLetterSchema.safeParse({ name: "Миша", gender: "boy", age: "5", achievements: ["a", "b", "c", "d"] }).success).toBe(false);
  expect(dedMorozLetterSchema.safeParse({ name: "Миша", gender: "boy", age: "5", extra: 1 }).success).toBe(false);
});

test("initial is the uppercased first letter of the name, empty when the font cannot show it", () => {
  expect(dedMorozLetterText({ name: "маша", gender: "girl", age: "4" }).initial).toBe("М");
  expect(dedMorozLetterText({ name: "ёжик", gender: "boy", age: "7" }).initial).toBe("Ё");
  expect(dedMorozLetterText({ name: "Leo", gender: "boy", age: "12" }).initial).toBe("L");
  expect(dedMorozLetterText({ name: "🎄Аня", gender: "girl", age: "5" }).initial).toBe("А");
});

test("emoji and glyphs the fonts lack are dropped, never printed as question marks", () => {
  const letter = dedMorozLetterText({ name: "Аня 🎄", gender: "girl", age: "6", achievements: ["научилась плавать 🏊"], gift: "самокат 🛴" });
  expect(letter.greeting).toBe("Здравствуй, дорогая Аня!");
  expect(letter.paragraphs.join(" ")).not.toContain("?");
  expect(letter.paragraphs.join(" ")).toContain("желание — самокат — я");
  expect(dedMorozLetterSchema.safeParse({ name: "小明", gender: "boy", age: "5" }).success).toBe(false);
});

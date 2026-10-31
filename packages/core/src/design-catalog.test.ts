import { expect, test } from "vitest";
import { orderedThemes, seasonalBoost } from "./design-catalog";

test.each([
  ["2026-10-31", null],
  ["2026-11-14", null],
  ["2026-11-15", "new-year"],
  ["2026-12-31", "new-year"],
  ["2027-01-01", "new-year"],
  ["2027-01-10", "new-year"],
  ["2027-01-11", null],
  ["2027-01-24", null],
  ["2027-01-25", "valentines"],
  ["2027-02-15", "valentines"],
  ["2027-02-16", null],
  ["2027-02-19", null],
  ["2027-02-20", "march-8"],
  ["2027-03-10", "march-8"],
  ["2027-03-11", null],
] as const)("seasonal promotion on %s is %s", (day, expected) => {
  expect(seasonalBoost(new Date(`${day}T12:00:00`))?.id ?? null).toBe(expected);
});

test("seasonal promotion retains every theme and the order of other themes", () => {
  const result = orderedThemes(new Date("2026-11-15T12:00:00"));
  expect(result.map(({ entry }) => entry.id)).toEqual([
    "new-year", "journal", "children", "children-pink", "celebration",
    "wedding", "quiet-luxury", "space", "flower-garden", "valentines", "march-8",
  ]);
  expect(result.filter(({ badge }) => badge).map(({ entry }) => entry.id)).toEqual(["new-year"]);
  expect(orderedThemes(new Date("2026-10-31T12:00:00"))[0]?.entry.id).toBe("journal");
});

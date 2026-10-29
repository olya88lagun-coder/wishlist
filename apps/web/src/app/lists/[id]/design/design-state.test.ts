import { expect, test } from "vitest";
import { isUnsavedSelection } from "./design-state";

test("a purchased colour that differs from the saved one is unsaved", () => {
  expect(isUnsavedSelection("children-pink", "children", true)).toBe(true);
  expect(isUnsavedSelection("journal", "children", true)).toBe(true);
});

test("the saved theme itself is not flagged", () => {
  expect(isUnsavedSelection("children", "children", true)).toBe(false);
});

test("a theme that is not bought cannot be applied, so there is nothing to save", () => {
  expect(isUnsavedSelection("new-year", "journal", false)).toBe(false);
});

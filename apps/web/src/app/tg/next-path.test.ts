import { expect, test } from "vitest";
import { DEFAULT_NEXT_PATH, safeNextPath } from "./next-path";

test("keeps in-app paths from the bot", () => {
  expect(safeNextPath("/lists/3c5e5e81-358d-4c3d-b4ed-100bac8fea49")).toBe("/lists/3c5e5e81-358d-4c3d-b4ed-100bac8fea49");
  expect(safeNextPath("/me")).toBe("/me");
});

test("anything that could leave the site falls back to the lists", () => {
  for (const raw of [null, "", "lists", "//evil.example", "/\evil.example", "https://evil.example/lists", "/lists\nx"]) {
    expect(safeNextPath(raw)).toBe(DEFAULT_NEXT_PATH);
  }
});

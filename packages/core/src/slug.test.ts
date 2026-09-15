import { describe, expect, test } from "vitest";
import { generateSlug, isValidSlug, SLUG_LENGTH } from "./slug";

describe("generateSlug", () => {
  test("produces 10 url-safe alphanumeric characters", () => {
    for (let i = 0; i < 200; i++) expect(generateSlug()).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(SLUG_LENGTH).toBe(10);
  });

  test("does not repeat across many generations", () => {
    const seen = new Set(Array.from({ length: 5000 }, generateSlug));
    expect(seen.size).toBe(5000);
  });
});

describe("isValidSlug", () => {
  test("accepts generated slugs and rejects everything else", () => {
    expect(isValidSlug(generateSlug())).toBe(true);
    expect(isValidSlug("abc")).toBe(false);
    expect(isValidSlug("abcdefghi!")).toBe(false);
    expect(isValidSlug("login")).toBe(false);
  });
});

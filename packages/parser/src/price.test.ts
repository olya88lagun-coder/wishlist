import { expect, test } from "vitest";
import { toKopecks } from "./price";

test("reads prices from numbers and store-formatted strings", () => {
  expect(toKopecks(2490)).toBe(249000);
  expect(toKopecks(1472.5)).toBe(147250);
  expect(toKopecks("2490.00")).toBe(249000);
  expect(toKopecks("2 891 ₽")).toBe(289100);
  expect(toKopecks("1 234,56")).toBe(123456);
});

test("rejects zero, negative, huge and non-price values", () => {
  expect(toKopecks(0)).toBeNull();
  expect(toKopecks("0")).toBeNull();
  expect(toKopecks(-10)).toBeNull();
  expect(toKopecks(10_000_001)).toBeNull();
  expect(toKopecks("по запросу")).toBeNull();
  expect(toKopecks(undefined)).toBeNull();
  expect(toKopecks({ price: 1 })).toBeNull();
});

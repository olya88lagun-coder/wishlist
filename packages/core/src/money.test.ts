import { describe, expect, test } from "vitest";
import { formatKopecks, parseRublesToKopecks } from "./money";

describe("parseRublesToKopecks", () => {
  test.each([
    ["24990", 2499000],
    ["24 990", 2499000],
    ["24 990", 2499000],
    ["1990,50", 199050],
    ["1990.5", 199050],
    ["  700 ₽ ", 70000],
    ["0", 0],
  ])("%s → %i", (input, expected) => {
    expect(parseRublesToKopecks(input)).toBe(expected);
  });

  test.each([[""], ["   "], ["abc"], ["-5"], ["1.234"], ["10000001"], ["12,3,4"]])("rejects %j", (input) => {
    expect(parseRublesToKopecks(input)).toBeNull();
  });
});

describe("formatKopecks", () => {
  test("formats whole rubles with non-breaking group separators", () => {
    expect(formatKopecks(2499000)).toBe("24 990 ₽");
    expect(formatKopecks(70000)).toBe("700 ₽");
  });
  test("keeps kopecks when present", () => {
    expect(formatKopecks(199050)).toBe("1 990,50 ₽");
  });
});

import { afterEach, expect, test, vi } from "vitest";
import { freeDesignTelegramIds, parseFreeDesignTelegramIds } from "./free-designs";

afterEach(() => vi.unstubAllEnvs());

test("empty or missing setting means nobody gets designs for free", () => {
  expect(parseFreeDesignTelegramIds(undefined)).toEqual([]);
  expect(parseFreeDesignTelegramIds("")).toEqual([]);
  expect(parseFreeDesignTelegramIds(" , ")).toEqual([]);
});

test("accepts a comma separated list of numeric Telegram ids and ignores anything else", () => {
  expect(parseFreeDesignTelegramIds("123456, 789")).toEqual(["123456", "789"]);
  expect(parseFreeDesignTelegramIds("123456,abc,12.5,-5,*,789")).toEqual(["123456", "789"]);
});

test("reads the setting from the environment", () => {
  vi.stubEnv("FREE_DESIGN_TELEGRAM_IDS", "42");
  expect(freeDesignTelegramIds()).toEqual(["42"]);
});

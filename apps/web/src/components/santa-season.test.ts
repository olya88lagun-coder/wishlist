import { expect, test } from "vitest";
import { isDedMorozSeason, isSantaSeason } from "./santa-season";

test.each([
  ["2026-10-31T20:59:00Z", false], // 23:59 31 октября по Москве
  ["2026-10-31T21:00:00Z", true], // 00:00 1 ноября по Москве
  ["2026-12-31T12:00:00Z", true],
  ["2027-01-15T20:59:00Z", true], // 23:59 15 января по Москве
  ["2027-01-15T21:00:00Z", false], // 00:00 16 января по Москве
  ["2027-06-01T12:00:00Z", false],
  ["2027-11-01T12:00:00Z", true],
])("Santa season at %s is %s", (iso, expected) => {
  expect(isSantaSeason(new Date(iso))).toBe(expected);
});

test.each([
  ["2026-10-31T20:59:00Z", false], // 23:59 31 октября по Москве
  ["2026-10-31T21:00:00Z", true], // 00:00 1 ноября по Москве
  ["2026-12-31T20:59:00Z", true], // 23:59 31 декабря по Москве
  ["2026-12-31T21:00:00Z", false], // 00:00 1 января по Москве
  ["2027-01-10T12:00:00Z", false],
  ["2027-11-15T12:00:00Z", true],
])("Ded Moroz letter season at %s is %s", (iso, expected) => {
  expect(isDedMorozSeason(new Date(iso))).toBe(expected);
});

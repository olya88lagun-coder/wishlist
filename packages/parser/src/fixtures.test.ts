import { describe, expect, test } from "vitest";
import { readFixture } from "./read-fixture";

describe("store fixtures captured from the Moscow server", () => {
  test("Wildberries page carries a JSON-LD Product", () => {
    const html = readFixture("wildberries.html");
    expect(html).toMatch(/application\/ld\+json/);
    expect(html).toMatch(/"@type"\s*:\s*"Product"/);
  });

  test("Gold Apple page carries OpenGraph and a microdata price", () => {
    const html = readFixture("goldapple.html");
    expect(html).toMatch(/property="og:title"/);
    expect(html).toMatch(/itemprop="price"/);
  });
});

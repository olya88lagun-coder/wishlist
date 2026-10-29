import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync(new URL("./owner.css", import.meta.url), "utf8");

test("owner shell forces link colour, so the design promo button restores its own text colour", () => {
  expect(css).toMatch(/\.owner-shell a \{ color: inherit; \}/);
  expect(css).toMatch(/\.owner-design-promo a\.button \{ color: var\(--paper\); \}/);
  expect(css).toMatch(/\.owner-design-promo a\.button--ghost \{ color: var\(--ink\); \}/);
});

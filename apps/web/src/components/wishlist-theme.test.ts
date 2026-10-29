import { readFileSync, existsSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync(new URL("./wishlist-theme.css", import.meta.url), "utf8");
test("theme artwork exists and covers retain natural proportions", () => {
  const sources = [...css.matchAll(/url\('\/themes\/([^']+)'\)/g)];
  expect(sources.length).toBeGreaterThan(0);
  for (const [, file] of sources) expect(existsSync(new URL(`../../public/themes/${file}`, import.meta.url))).toBe(true);
  expect(css).toContain("100% auto no-repeat");
  expect(css).not.toContain("background-size: 200% 100%");
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { CookieConsent } from "./CookieConsent";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "cookie-consent.css"), "utf8");

test("server render stays empty until the client reads consent", () => {
  expect(renderToStaticMarkup(<CookieConsent />)).toBe("");
});

test("cookie bar uses warm paper and home brand tokens and stays compact on mobile", () => {
  expect(css).toMatch(/--paper/);
  expect(css).toMatch(/--home-ink:\s*#1d1b18/);
  expect(css).toMatch(/--home-gold:\s*#9c7843/);
  expect(css).toMatch(/@media \(max-width: 600px\)/);
  expect(css).toMatch(/min-height:\s*28px/);
  expect(css).toMatch(/font-size:\s*11px/);
});

test("button labels stay Принять and Только нужные", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "CookieConsent.tsx"), "utf8");
  expect(source).toMatch(/>\s*Принять\s*</);
  expect(source).toMatch(/>\s*Только нужные\s*</);
});

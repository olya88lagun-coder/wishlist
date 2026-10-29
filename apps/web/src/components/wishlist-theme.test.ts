import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync(new URL("./wishlist-theme.css", import.meta.url), "utf8");
const decorUrl = /url\('\/themes\/(?:children-decor(?:-pink)?\.png|new-year-decor\.webp)'\)[^;}]*/g;

test("decor frames keep their proportions: never stretched to a fixed width and height", () => {
  const declarations = css.match(decorUrl) ?? [];
  expect(declarations.length).toBeGreaterThan(0);
  for (const declaration of declarations) expect(declaration).not.toMatch(/\/\s*[\d.]+(?:%|px)\s+[\d.]+px/);
});

test("decor halves sit in the page corners at the picture's own 3:2 proportion and are capped in width", () => {
  expect(css).toMatch(/\.wishlist-page::before,[\s\S]*?\.wishlist-page::after \{[^}]*width: min\(36%, 300px\); aspect-ratio: 3 \/ 2;[^}]*background-size: 200% 100%/);
  expect(css).toMatch(/\.wishlist-page::before \{ left: 0; background-position: left top; \}/);
  expect(css).toMatch(/\.wishlist-page::after \{ right: 0; background-position: right top; \}/);
});

test("pink decor overrides the generic children decor (declared later, same specificity)", () => {
  expect(css.indexOf(`[data-theme="children-pink"] { --decor-image`)).toBeGreaterThan(css.indexOf(`[data-theme^="children"] { --decor-image`));
});

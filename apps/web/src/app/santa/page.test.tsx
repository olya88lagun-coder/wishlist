import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import SantaLandingPage, { metadata } from "./page";

test("the landing is open to search and targets the online draw query", () => {
  expect(metadata.robots).toMatchObject({ index: true, follow: true });
  expect(metadata.alternates?.canonical).toBe("/santa");
  expect(String((metadata.title as { absolute: string }).absolute)).toMatch(/^Тайный Санта онлайн/);
  expect([...(metadata.title as { absolute: string }).absolute].length).toBeLessThanOrEqual(70);
  expect(metadata.description).toMatch(/жеребь[её]вк/i);
});

test("the landing leads to game creation and carries FAQ markup", () => {
  const html = renderToStaticMarkup(<SantaLandingPage />);
  expect(html.replace(/<\/?em>/g, "")).toMatch(/<h1[^>]*>Тайный Санта онлайн/);
  expect(html).toMatch(/<a[^>]*href="\/santa\/new"[^>]*>Создать игру/);
  expect(html).toContain('"@type":"FAQPage"');
  expect(html).toContain("без регистрации");
});

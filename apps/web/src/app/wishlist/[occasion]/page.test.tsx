import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import WishlistLandingPage, { generateMetadata, generateStaticParams } from "./page";

test("builds a landing for each wishlist occasion", () => {
  expect(generateStaticParams()).toEqual([{ occasion: "birthday" }, { occasion: "new-year" }]);
});

test.each([
  ["birthday", "Вишлист на день рождения", "/gifts/birthday"],
  ["new-year", "Вишлист на Новый год 2027", "/gifts/new-year"],
])("the %s landing targets its query and leads to list creation", async (occasion, heading, ideas) => {
  const metadata = await generateMetadata({ params: Promise.resolve({ occasion }) });
  const html = renderToStaticMarkup(await WishlistLandingPage({ params: Promise.resolve({ occasion }) }));
  expect(JSON.stringify(metadata.title)).toContain(heading);
  expect(metadata.alternates?.canonical).toBe(`/wishlist/${occasion}`);
  expect(html).toMatch(new RegExp(`<h1[^>]*>${heading}</h1>`));
  expect(html).toContain('href="/lists">Создать вишлист бесплатно</a>');
  expect(html).toContain(`href="${ideas}"`);
  expect(html).toContain('"@type":"FAQPage"');
});

test("unknown occasions are not served", async () => {
  await expect(WishlistLandingPage({ params: Promise.resolve({ occasion: "toString" }) })).rejects.toThrow();
});

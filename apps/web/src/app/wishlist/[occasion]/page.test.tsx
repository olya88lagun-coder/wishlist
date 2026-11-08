import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import WishlistLandingPage, { generateMetadata, generateStaticParams } from "./page";

test("builds a landing for each wishlist occasion", () => {
  expect(generateStaticParams()).toEqual([{ occasion: "birthday" }, { occasion: "new-year" }, { occasion: "pismo-dedu-morozu" }]);
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

test("the Ded Moroz letter landing leads to list creation with its own call to action", async () => {
  const html = renderToStaticMarkup(await WishlistLandingPage({ params: Promise.resolve({ occasion: "pismo-dedu-morozu" }) }));
  expect(html).toMatch(/<h1[^>]*>Письмо Деду Морозу онлайн<\/h1>/);
  expect(html).toContain('href="/lists?preset=ded-moroz">Написать письмо Деду Морозу</a>');
  expect(html).toContain("wishlist-pismo-dedu-morozu.webp");
  expect(html).toContain('href="/blank-pismo-dedu-morozu.pdf" download="">Скачать бланк</a>');
  expect(html).toContain('href="/ded-moroz-envelope-a4.pdf" download="">Скачать конверт A4</a>');
});

test("unknown occasions are not served", async () => {
  await expect(WishlistLandingPage({ params: Promise.resolve({ occasion: "toString" }) })).rejects.toThrow();
});

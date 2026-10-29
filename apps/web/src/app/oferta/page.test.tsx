import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { OPERATOR } from "../privacy/operator";
import OfertaPage, { metadata } from "./page";
import { OFFER_PRODUCTS } from "./offer";

test("offer lists every paid product with its price", () => {
  expect(OFFER_PRODUCTS.map((product) => product.price)).toEqual(["149 ₽", "199 ₽", "50 ₽", "149 ₽"]);
  const html = renderToStaticMarkup(<OfertaPage />);
  for (const product of OFFER_PRODUCTS) expect(html).toContain(product.price);
});

test("offer names the seller and the contact for refunds", () => {
  const html = renderToStaticMarkup(<OfertaPage />);
  expect(html).toContain(OPERATOR.name);
  expect(html).toContain(OPERATOR.inn);
  expect(html).toContain(`mailto:${OPERATOR.email}`);
});

test("offer says the receipt is issued by the seller and never promises an automatic one", () => {
  const html = renderToStaticMarkup(<OfertaPage />);
  expect(html).toContain("Мой налог");
  expect(html).not.toMatch(/автоматическ|мгновенн|сразу придёт/i);
});

test("offer is a private legal page that is not indexed", () => {
  expect(metadata.robots).toEqual({ index: false, follow: false });
});

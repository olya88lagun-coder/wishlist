import { describe, expect, test } from "vitest";
import { extractJsonLdProduct } from "./extract/jsonld";
import { extractMicrodata } from "./extract/microdata";
import { extractOpenGraph } from "./extract/opengraph";
import { readFixture } from "./read-fixture";
import { parseHtml } from "./html";
import { mergeProduct, statusFor } from "./merge";

function parseFixture(name: string, pageUrl: string) {
  const root = parseHtml(readFixture(name));
  return mergeProduct(pageUrl, [extractJsonLdProduct(root), extractMicrodata(root), extractOpenGraph(root)]);
}

// Фикстуры заморожены, поэтому точные значения здесь — регрессия; при обновлении фикстуры обновить и их
describe("real store pages", () => {
  test("Wildberries: title, photo and price from JSON-LD", () => {
    const product = parseFixture("wildberries.html", "https://www.wildberries.ru/catalog/173937886/detail.aspx");
    expect(product).toMatchObject({
      title: "Наушники беспроводные спортивные с микрофоном bluetooth, Dressphone",
      imageUrl: "https://basket-12.wbbasket.ru/vol1739/part173937/173937886/images/big/1.webp",
      priceKopecks: 147200,
    });
    expect(statusFor(product)).toBe("ok");
  });

  test("Gold Apple: title and price from microdata, photo from OpenGraph", () => {
    const product = parseFixture("goldapple.html", "https://goldapple.ru/");
    expect(product).toMatchObject({
      title: "EPC. EXPERIMENTAL PERFUME CLUB Парфюмерная вода CARDAMOM MOSS 50 мл",
      imageUrl: "https://ccdn.goldapple.ru/p/p/19000378828/imgmain_14655020a8f64af2a9bb8ef6cce27a8f.jpg",
      priceKopecks: 1197500,
    });
  });

});

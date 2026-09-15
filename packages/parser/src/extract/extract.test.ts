import { describe, expect, test } from "vitest";
import { parseHtml } from "../html";
import { extractJsonLdProduct } from "./jsonld";
import { extractMicrodata } from "./microdata";
import { extractOpenGraph } from "./opengraph";

const page = (head: string, body = "") => parseHtml(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`);

describe("extractJsonLdProduct", () => {
  test("reads a plain Product with a single offer", () => {
    const root = page(`<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Диффузор для дома","description":"Морская соль",
       "image":"https://basket-01.wbbasket.ru/big/1.webp","offers":{"@type":"Offer","price":"2891.00","priceCurrency":"RUB"}}
    </script>`);
    expect(extractJsonLdProduct(root)).toEqual({
      title: "Диффузор для дома",
      description: "Морская соль",
      imageUrl: "https://basket-01.wbbasket.ru/big/1.webp",
      priceKopecks: 289100,
      currency: "RUB",
    });
  });

  test("finds Product inside @graph and arrays, with image objects and AggregateOffer", () => {
    const root = page(`
      <script type="application/ld+json">{ broken json </script>
      <script type="application/ld+json">[{"@type":"BreadcrumbList"},
        {"@graph":[{"@type":["Thing","Product"],"name":"Помада","image":[{"@type":"ImageObject","url":"/img/p.jpg"}],
          "offers":[{"@type":"AggregateOffer","lowPrice":990,"priceCurrency":"RUB"}]}]}]</script>`);
    expect(extractJsonLdProduct(root)).toEqual({
      title: "Помада",
      description: null,
      imageUrl: "/img/p.jpg",
      priceKopecks: 99000,
      currency: "RUB",
    });
  });

  test("returns nothing when there is no Product", () => {
    expect(extractJsonLdProduct(page(`<script type="application/ld+json">{"@type":"Organization"}</script>`))).toEqual({});
  });
});

describe("extractOpenGraph", () => {
  test("reads og and product price tags, decoding entities", () => {
    const root = page(`
      <meta property="og:title" content="Наушники &quot;Sony&quot; WH-1000XM5">
      <meta property="og:description" content="Шумоподавление &amp; 30 часов">
      <meta property="og:image" content="https://avatars.mds.yandex.net/get-mpic/1/orig">
      <meta property="product:price:amount" content="24990">
      <meta property="product:price:currency" content="RUB">
      <title>Не то название</title>`);
    expect(extractOpenGraph(root)).toEqual({
      title: 'Наушники "Sony" WH-1000XM5',
      description: "Шумоподавление & 30 часов",
      imageUrl: "https://avatars.mds.yandex.net/get-mpic/1/orig",
      priceKopecks: 2499000,
      currency: "RUB",
    });
  });

  test("falls back to <title> and meta description", () => {
    const root = page(`<title> Свеча  ароматическая </title><meta name="description" content="Воск">`);
    expect(extractOpenGraph(root)).toMatchObject({ title: "Свеча  ароматическая", description: "Воск", imageUrl: null, priceKopecks: null });
  });
});

describe("extractMicrodata", () => {
  test("reads price from content attribute or text and product name", () => {
    const root = page(
      "",
      `<div itemscope itemtype="https://schema.org/Product">
         <h1 itemprop="name">Маска для губ</h1>
         <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
           <meta itemprop="priceCurrency" content="RUB"><span itemprop="price" content="1350">1 350 ₽</span>
         </div>
       </div>`,
    );
    expect(extractMicrodata(root)).toEqual({ title: "Маска для губ", priceKopecks: 135000, currency: "RUB" });
  });

  test("takes the name of the product itself, not of nested breadcrumbs or offers", () => {
    const root = page(
      "",
      `<div itemscope itemtype="https://schema.org/Product">
         <ol itemscope itemtype="https://schema.org/BreadcrumbList"><li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">главная</span></li></ol>
         <meta itemprop="name" content="Парфюмерная вода Cardamom Moss">
       </div>`,
    );
    expect(extractMicrodata(root).title).toBe("Парфюмерная вода Cardamom Moss");
  });

  test("skips zero placeholder prices (Gold Apple guest price button)", () => {
    expect(extractMicrodata(page("", `<meta itemprop="price" content="0"><div itemprop="offers"><meta itemprop="price" content="11975"></div>`)).priceKopecks).toBe(1197500);
  });

  test("reads price text when there is no content attribute", () => {
    expect(extractMicrodata(page("", `<span itemprop="price">2 490</span>`))).toEqual({ title: null, priceKopecks: 249000, currency: null });
  });
});

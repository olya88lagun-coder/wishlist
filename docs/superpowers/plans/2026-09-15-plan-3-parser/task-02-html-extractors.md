# Task 2: Извлечение данных из HTML

**Files:**
- Create: `packages/parser/src/html.ts`, `packages/parser/src/price.ts`, `packages/parser/src/extract/jsonld.ts`, `packages/parser/src/extract/opengraph.ts`, `packages/parser/src/extract/microdata.ts`, `packages/parser/src/merge.ts`
- Modify: `packages/parser/src/index.ts`
- Test: `packages/parser/src/price.test.ts`, `packages/parser/src/extract/extract.test.ts`, `packages/parser/src/merge.test.ts`, `packages/parser/src/real-fixtures.test.ts`

**Interfaces:**
- Consumes: `ParsedProduct`, `ParseStatus`, `EMPTY_PRODUCT` (Task 1); `parseRublesToKopecks`, `MAX_PRICE_RUBLES` из `@wishlist/core`; `readFixture` из `read-fixture.ts` (Task 1).
- Produces:
  ```ts
  // html.ts
  type HtmlRoot = HTMLElement /* node-html-parser */;
  function parseHtml(html: string): HtmlRoot;
  // price.ts
  function toKopecks(value: unknown): number | null;            // > 0 и ≤ MAX_PRICE_RUBLES, иначе null
  // extract/*
  function extractJsonLdProduct(root: HtmlRoot): Partial<ParsedProduct>;
  function extractOpenGraph(root: HtmlRoot): Partial<ParsedProduct>;
  function extractMicrodata(root: HtmlRoot): Partial<ParsedProduct>;
  // merge.ts
  const TITLE_MAX = 200;          // совпадает с ITEM_TITLE_MAX из @wishlist/db
  const DESCRIPTION_MAX = 1000;
  function mergeProduct(pageUrl: string, parts: Partial<ParsedProduct>[]): ParsedProduct;
  function statusFor(product: Pick<ParsedProduct, "title" | "priceKopecks">): ParseStatus;
  ```
- Приоритет источников задаёт порядок `parts`: для каждого поля берётся первое непустое значение.

- [x] **Step 1: Цена (тест → реализация)**

`packages/parser/src/price.test.ts`:
```ts
import { expect, test } from "vitest";
import { toKopecks } from "./price";

test("reads prices from numbers and store-formatted strings", () => {
  expect(toKopecks(2490)).toBe(249000);
  expect(toKopecks(1472.5)).toBe(147250);
  expect(toKopecks("2490.00")).toBe(249000);
  expect(toKopecks("2 891 ₽")).toBe(289100);
  expect(toKopecks("1 234,56")).toBe(123456);
});

test("rejects zero, negative, huge and non-price values", () => {
  expect(toKopecks(0)).toBeNull();
  expect(toKopecks("0")).toBeNull();
  expect(toKopecks(-10)).toBeNull();
  expect(toKopecks(10_000_001)).toBeNull();
  expect(toKopecks("по запросу")).toBeNull();
  expect(toKopecks(undefined)).toBeNull();
  expect(toKopecks({ price: 1 })).toBeNull();
});
```

Run: `pnpm vitest run packages/parser/src/price.test.ts`
Expected: FAIL — `Cannot find module './price'`.

`packages/parser/src/price.ts`:
```ts
import { MAX_PRICE_RUBLES, parseRublesToKopecks } from "@wishlist/core";

const KOPECKS_PER_RUBLE = 100;

export function toKopecks(value: unknown): number | null {
  let kopecks: number | null = null;
  if (typeof value === "number" && Number.isFinite(value) && value <= MAX_PRICE_RUBLES) {
    kopecks = Math.round(value * KOPECKS_PER_RUBLE);
  } else if (typeof value === "string") {
    kopecks = parseRublesToKopecks(value);
  }
  return kopecks !== null && kopecks > 0 ? kopecks : null;
}
```

Run: `pnpm vitest run packages/parser/src/price.test.ts`
Expected: PASS.

- [x] **Step 2: Экстракторы (тест)**

`packages/parser/src/extract/extract.test.ts`:
```ts
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

  test("reads price text when there is no content attribute", () => {
    expect(extractMicrodata(page("", `<span itemprop="price">2 490</span>`))).toEqual({ title: null, priceKopecks: 249000, currency: null });
  });
});
```

Run: `pnpm vitest run packages/parser/src/extract`
Expected: FAIL — `Cannot find module '../html'`.

- [x] **Step 3: Экстракторы (реализация)**

`packages/parser/src/html.ts`:
```ts
import { type HTMLElement, parse } from "node-html-parser";

export type HtmlRoot = HTMLElement;

// Текст <script> нужен сырым (JSON-LD); атрибуты и текст node-html-parser отдаёт с декодированными сущностями
export function parseHtml(html: string): HtmlRoot {
  return parse(html, { comment: false, blockTextElements: { script: true, style: false, noscript: false, pre: false } });
}
```

`packages/parser/src/extract/jsonld.ts`:
```ts
import type { HtmlRoot } from "../html";
import { toKopecks } from "../price";
import type { ParsedProduct } from "../types";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

function* nodes(value: unknown): Generator<JsonObject> {
  if (Array.isArray(value)) {
    for (const entry of value) yield* nodes(entry);
    return;
  }
  if (!isObject(value)) return;
  yield value;
  if (value["@graph"] !== undefined) yield* nodes(value["@graph"]);
}

function isProduct(node: JsonObject): boolean {
  const type = node["@type"];
  return type === "Product" || (Array.isArray(type) && type.includes("Product"));
}

function firstText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = firstText(entry);
      if (text) return text;
    }
    return null;
  }
  if (isObject(value)) return firstText(value.url ?? value.contentUrl);
  return null;
}

function offerPrice(offers: unknown): Pick<ParsedProduct, "priceKopecks" | "currency"> {
  for (const offer of Array.isArray(offers) ? offers : [offers]) {
    if (!isObject(offer)) continue;
    const specification = isObject(offer.priceSpecification) ? offer.priceSpecification.price : undefined;
    const priceKopecks = toKopecks(offer.price ?? offer.lowPrice ?? specification);
    if (priceKopecks !== null) return { priceKopecks, currency: typeof offer.priceCurrency === "string" ? offer.priceCurrency : null };
  }
  return { priceKopecks: null, currency: null };
}

export function extractJsonLdProduct(root: HtmlRoot): Partial<ParsedProduct> {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.rawText);
    } catch {
      continue;
    }
    for (const node of nodes(data)) {
      if (!isProduct(node)) continue;
      return { title: firstText(node.name), description: firstText(node.description), imageUrl: firstText(node.image), ...offerPrice(node.offers) };
    }
  }
  return {};
}
```

`packages/parser/src/extract/opengraph.ts`:
```ts
import type { HtmlRoot } from "../html";
import { toKopecks } from "../price";
import type { ParsedProduct } from "../types";

function metaContent(root: HtmlRoot, key: string): string | null {
  const element = root.querySelector(`meta[property="${key}"]`) ?? root.querySelector(`meta[name="${key}"]`);
  const content = element?.getAttribute("content")?.trim();
  return content ? content : null;
}

export function extractOpenGraph(root: HtmlRoot): Partial<ParsedProduct> {
  const titleTag = root.querySelector("title")?.text.trim();
  return {
    title: metaContent(root, "og:title") ?? (titleTag ? titleTag : null),
    description: metaContent(root, "og:description") ?? metaContent(root, "description"),
    imageUrl: metaContent(root, "og:image:secure_url") ?? metaContent(root, "og:image"),
    priceKopecks: toKopecks(metaContent(root, "product:price:amount") ?? metaContent(root, "og:price:amount")),
    currency: metaContent(root, "product:price:currency") ?? metaContent(root, "og:price:currency"),
  };
}
```

`packages/parser/src/extract/microdata.ts`:
```ts
import type { HtmlRoot } from "../html";
import { toKopecks } from "../price";
import type { ParsedProduct } from "../types";

function valueOf(root: HtmlRoot, selector: string): string | null {
  const element = root.querySelector(selector);
  if (!element) return null;
  const value = (element.getAttribute("content") ?? element.text).trim();
  return value === "" ? null : value;
}

export function extractMicrodata(root: HtmlRoot): Partial<ParsedProduct> {
  return {
    title: valueOf(root, '[itemtype*="schema.org/Product"] [itemprop="name"]'),
    priceKopecks: toKopecks(valueOf(root, '[itemprop="price"]') ?? valueOf(root, '[itemprop="lowPrice"]')),
    currency: valueOf(root, '[itemprop="priceCurrency"]'),
  };
}
```

Run: `pnpm vitest run packages/parser/src/extract`
Expected: PASS (7 тестов). Если падает декодирование `&quot;` в `getAttribute` — в node-html-parser 9 атрибуты должны приходить декодированными; при расхождении обернуть значения в `decode` из `node-html-parser` (`import { parse, decode } ...`) и повторить.

- [x] **Step 4: Слияние и статус (тест)**

`packages/parser/src/merge.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { mergeProduct, statusFor, TITLE_MAX } from "./merge";

const PAGE = "https://goldapple.ru/19000180719-lip-mask";

describe("mergeProduct", () => {
  test("takes the first non-empty value per field in source order", () => {
    expect(
      mergeProduct(PAGE, [
        { title: "Из JSON-LD", priceKopecks: null, imageUrl: null },
        { title: null, priceKopecks: 135000, currency: "RUB" },
        { title: "Из OG", description: "Описание", imageUrl: "/media/p.jpg", priceKopecks: 999900 },
      ]),
    ).toEqual({
      title: "Из JSON-LD",
      description: "Описание",
      imageUrl: "https://goldapple.ru/media/p.jpg",
      priceKopecks: 135000,
      currency: "RUB",
    });
  });

  test("collapses whitespace, trims and cuts long text", () => {
    const merged = mergeProduct(PAGE, [{ title: `  Очень\n\n длинное ${"слово ".repeat(80)}` }]);
    expect(merged.title?.startsWith("Очень длинное слово")).toBe(true);
    expect(merged.title?.length).toBe(TITLE_MAX);
    expect(merged.title?.endsWith("…")).toBe(true);
  });

  test("drops non-http images and prices in foreign currency", () => {
    expect(mergeProduct(PAGE, [{ title: "Духи", imageUrl: "data:image/png;base64,AAAA", priceKopecks: 5000, currency: "USD" }])).toEqual({
      title: "Духи",
      description: null,
      imageUrl: null,
      priceKopecks: null,
      currency: null,
    });
  });

  test("treats RUR as roubles", () => {
    expect(mergeProduct(PAGE, [{ title: "Духи", priceKopecks: 5000, currency: "RUR" }]).priceKopecks).toBe(5000);
  });
});

describe("statusFor", () => {
  test("ok needs a title and a price; the photo does not matter", () => {
    expect(statusFor({ title: "Свеча", priceKopecks: 99000 })).toBe("ok");
    expect(statusFor({ title: "Свеча", priceKopecks: null })).toBe("partial");
    expect(statusFor({ title: null, priceKopecks: 99000 })).toBe("failed");
  });
});
```

Run: `pnpm vitest run packages/parser/src/merge.test.ts`
Expected: FAIL — `Cannot find module './merge'`.

- [x] **Step 5: Слияние и статус (реализация)**

`packages/parser/src/merge.ts`:
```ts
import type { ParsedProduct, ParseStatus } from "./types";

export const TITLE_MAX = 200; // = ITEM_TITLE_MAX в @wishlist/db
export const DESCRIPTION_MAX = 1000;
const ROUBLE_CODES = new Set(["RUB", "RUR"]);

function first<T>(values: (T | null | undefined)[]): T | null {
  return values.find((value) => value !== null && value !== undefined && value !== "") ?? null;
}

function cleanText(text: string | null, max: number): string | null {
  if (!text) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed === "") return null;
  return collapsed.length > max ? `${collapsed.slice(0, max - 1).trimEnd()}…` : collapsed;
}

function httpUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mergeProduct(pageUrl: string, parts: Partial<ParsedProduct>[]): ParsedProduct {
  const priceKopecks = first(parts.map((p) => p.priceKopecks));
  // валюту берём из того же источника, что и цену, иначе цена в $ могла бы получить чужой «RUB»
  const priceSource = priceKopecks === null ? undefined : parts.find((p) => p.priceKopecks === priceKopecks);
  const currency = priceSource?.currency ?? null;
  const foreign = currency !== null && !ROUBLE_CODES.has(currency.toUpperCase());
  return {
    title: cleanText(first(parts.map((p) => p.title)), TITLE_MAX),
    description: cleanText(first(parts.map((p) => p.description)), DESCRIPTION_MAX),
    imageUrl: httpUrl(first(parts.map((p) => p.imageUrl)), pageUrl),
    priceKopecks: foreign ? null : priceKopecks,
    currency: foreign ? null : currency,
  };
}

export function statusFor(product: Pick<ParsedProduct, "title" | "priceKopecks">): ParseStatus {
  if (!product.title) return "failed";
  return product.priceKopecks === null ? "partial" : "ok";
}
```

Run: `pnpm vitest run packages/parser/src/merge.test.ts`
Expected: PASS (5 тестов).

- [x] **Step 6: Настоящие страницы (тест → проверка)**

`packages/parser/src/real-fixtures.test.ts`:
```ts
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

// Точные строки меняются вместе с витриной, поэтому проверяем форму результата, а не тексты
describe("real store pages", () => {
  test("Wildberries: title, photo and price from JSON-LD", () => {
    const product = parseFixture("wildberries.html", "https://www.wildberries.ru/catalog/173937886/detail.aspx");
    expect(product.title).toMatch(/\p{L}{3,}/u);
    expect(product.imageUrl).toMatch(/^https:\/\//);
    expect(product.priceKopecks).toBeGreaterThan(0);
    expect(statusFor(product)).toBe("ok");
  });

  test("Gold Apple: title and price", () => {
    const product = parseFixture("goldapple.html", "https://goldapple.ru/");
    expect(product.title).toMatch(/\p{L}{3,}/u);
    expect(product.priceKopecks).toBeGreaterThan(0);
  });

  test("Yandex Market: title and photo from OpenGraph", () => {
    const product = parseFixture("yandex-market.html", "https://market.yandex.ru/");
    expect(product.title).toMatch(/\p{L}{3,}/u);
    expect(product.imageUrl).toMatch(/^https:\/\//);
  });
});
```

Run: `pnpm vitest run packages/parser/src/real-fixtures.test.ts`
Expected: PASS. Если какой-то магазин не отдаёт поле, которое обещал спайк, — не подгонять тест под пустоту: посмотреть, где данные лежат в фикстуре (`grep -o '"price[A-Za-z]*":[^,]*' packages/parser/fixtures/<файл> | head`), добавить поддержку этого места в экстрактор с отдельным синтетическим тестом в `extract.test.ts`, затем повторить.

- [x] **Step 7: Экспорт, проверка, commit**

`packages/parser/src/index.ts`:
```ts
export * from "./types";
export * from "./html";
export * from "./price";
export * from "./merge";
export { extractJsonLdProduct } from "./extract/jsonld";
export { extractOpenGraph } from "./extract/opengraph";
export { extractMicrodata } from "./extract/microdata";
```

Run: `pnpm vitest run packages/parser && pnpm typecheck`
Expected: PASS.

```bash
git add packages/parser
git commit -m "feat(parser): JSON-LD, OpenGraph and microdata extractors"
```

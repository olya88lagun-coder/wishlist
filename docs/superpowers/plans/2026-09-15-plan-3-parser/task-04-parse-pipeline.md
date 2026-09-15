# Task 4: Стратегии магазинов и пайплайн `parseProduct`

**Files:**
- Create: `packages/parser/src/strategies.ts`, `packages/parser/src/slug-title.ts`, `packages/parser/src/pipeline.ts`
- Modify: `packages/parser/src/index.ts`
- Test: `packages/parser/src/slug-title.test.ts`, `packages/parser/src/pipeline.test.ts`

**Interfaces:**
- Consumes: `normalizeProductUrl`, `detectStore`, `StoreId` из `@wishlist/core`; `parseHtml`, `extractJsonLdProduct`, `extractMicrodata`, `extractOpenGraph`, `mergeProduct`, `statusFor` (Task 2); `FetchPage`, `FetchedPage`, `ParseResult`, `EMPTY_PRODUCT` (Task 1); `readFixture` (Task 1).
- Produces:
  ```ts
  // strategies.ts
  const MESSENGER_USER_AGENT = "WhatsApp/2.23.20.0";
  const LINK_PREVIEW_USER_AGENT = "TelegramBot (like TwitterBot)";
  type StoreStrategy = { fetch: boolean; userAgent: string; trustPrice: boolean };
  const STORE_STRATEGIES: Record<StoreId, StoreStrategy>;
  // slug-title.ts
  function titleFromUrlSlug(url: string, store: StoreId): string | null;
  // pipeline.ts
  type ParseDeps = { fetchPage: FetchPage; waitTurn?: (url: string) => Promise<void> };
  function parseProduct(rawUrl: string, deps: ParseDeps): Promise<ParseResult>;
  ```
- Стратегии — из таблицы спайка (спека 4.4): WB и Золотое Яблоко — UA мессенджера; Маркет — UA превью Telegram, цене не доверяем (на странице цены рекомендаций); Lamoda и Ozon — не ходим (антибот), название из slug; прочие — UA превью.
- Короткие ссылки (`clck.ru`, `wb.ru/...`) раскрываются редиректами: магазин определяется по конечному URL; если у конечного магазина другой UA — страница перезапрашивается с правильным.

- [ ] **Step 1: Название из URL (тест → реализация)**

`packages/parser/src/slug-title.test.ts`:
```ts
import { expect, test } from "vitest";
import { titleFromUrlSlug } from "./slug-title";

test("builds a readable title from Ozon and Lamoda slugs", () => {
  expect(titleFromUrlSlug("https://www.ozon.ru/product/dyuna-frenk-gerbert-1234567/", "ozon")).toBe("Dyuna frenk gerbert");
  expect(titleFromUrlSlug("https://www.ozon.ru/product/nabor-kistey-12-sht-987654321", "ozon")).toBe("Nabor kistey sht");
  expect(titleFromUrlSlug("https://www.lamoda.ru/p/rtlacv500701/clothes-mango-futbolka/", "lamoda")).toBe("Clothes mango futbolka");
});

test("returns null when the URL carries no usable slug", () => {
  expect(titleFromUrlSlug("https://ozon.ru/t/AbC12", "ozon")).toBeNull();
  expect(titleFromUrlSlug("https://www.ozon.ru/product/123456789/", "ozon")).toBeNull();
  expect(titleFromUrlSlug("https://www.wildberries.ru/catalog/1/detail.aspx", "wildberries")).toBeNull();
});
```

Run: `pnpm vitest run packages/parser/src/slug-title.test.ts`
Expected: FAIL — `Cannot find module './slug-title'`.

`packages/parser/src/slug-title.ts`:
```ts
import type { StoreId } from "@wishlist/core";

const SLUG_PATTERNS: Partial<Record<StoreId, RegExp>> = {
  ozon: /^\/product\/([a-z0-9-]+?)(?:-\d{5,})?\/?$/i,
  lamoda: /^\/p\/[a-z0-9]+\/([a-z0-9-]+)\/?$/i,
};
const MIN_LETTERS = 3;

export function titleFromUrlSlug(url: string, store: StoreId): string | null {
  const pattern = SLUG_PATTERNS[store];
  if (!pattern) return null;
  const slug = pattern.exec(new URL(url).pathname)?.[1];
  const words = (slug ?? "").split("-").filter((word) => word !== "" && !/^\d+$/.test(word));
  const text = words.join(" ");
  if (text.replace(/[^a-z]/gi, "").length < MIN_LETTERS) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
```

Run: `pnpm vitest run packages/parser/src/slug-title.test.ts`
Expected: PASS.

- [ ] **Step 2: Стратегии**

`packages/parser/src/strategies.ts`:
```ts
import type { StoreId } from "@wishlist/core";

export const MESSENGER_USER_AGENT = "WhatsApp/2.23.20.0";
export const LINK_PREVIEW_USER_AGENT = "TelegramBot (like TwitterBot)";

export type StoreStrategy = { fetch: boolean; userAgent: string; trustPrice: boolean };

// Спайк 2026-09-14 с московского VPS (спека 4.4)
export const STORE_STRATEGIES: Record<StoreId, StoreStrategy> = {
  wildberries: { fetch: true, userAgent: MESSENGER_USER_AGENT, trustPrice: true },
  goldapple: { fetch: true, userAgent: MESSENGER_USER_AGENT, trustPrice: true },
  yandex_market: { fetch: true, userAgent: LINK_PREVIEW_USER_AGENT, trustPrice: false },
  lamoda: { fetch: false, userAgent: LINK_PREVIEW_USER_AGENT, trustPrice: false },
  ozon: { fetch: false, userAgent: LINK_PREVIEW_USER_AGENT, trustPrice: false },
  other: { fetch: true, userAgent: LINK_PREVIEW_USER_AGENT, trustPrice: true },
};
```

- [ ] **Step 3: Пайплайн (тест)**

`packages/parser/src/pipeline.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { readFixture } from "./read-fixture";
import { parseProduct } from "./pipeline";
import { LINK_PREVIEW_USER_AGENT, MESSENGER_USER_AGENT } from "./strategies";
import type { FetchedPage, FetchPage } from "./types";

type Call = { url: string; userAgent: string };

function fakeFetch(pages: Record<string, FetchedPage | ((userAgent: string) => FetchedPage)>) {
  const calls: Call[] = [];
  const fetchPage: FetchPage = async (url, { userAgent }) => {
    calls.push({ url, userAgent });
    const page = pages[url];
    if (!page) return { ok: false, reason: "http_error", status: 404 };
    return typeof page === "function" ? page(userAgent) : page;
  };
  return { calls, fetchPage };
}

const html = (url: string, body: string): FetchedPage => ({ ok: true, url, status: 200, body });

const WB = "https://www.wildberries.ru/catalog/173937886/detail.aspx";

describe("parseProduct", () => {
  test("Wildberries: messenger UA, tracking params removed, ok with photo and price", async () => {
    const { calls, fetchPage } = fakeFetch({ [WB]: html(WB, readFixture("wildberries.html")) });
    const result = await parseProduct(`${WB}?utm_source=x`, { fetchPage });
    expect(calls).toEqual([{ url: WB, userAgent: MESSENGER_USER_AGENT }]);
    expect(result).toMatchObject({ status: "ok", store: "wildberries", finalUrl: WB });
    expect(result.imageUrl).toMatch(/^https:\/\//);
    expect(result.priceKopecks).toBeGreaterThan(0);
  });

  test("Yandex Market: ignores page prices, so the item is partial", async () => {
    const url = "https://market.yandex.ru/product--naushniki/1779261893";
    const page = html(url, '<meta property="og:title" content="Наушники Sony"><meta property="og:image" content="https://avatars.mds.yandex.net/i.jpg"><span itemprop="price">1990</span>');
    const { calls, fetchPage } = fakeFetch({ [url]: page });
    const result = await parseProduct(url, { fetchPage });
    expect(calls[0]?.userAgent).toBe(LINK_PREVIEW_USER_AGENT);
    expect(result).toMatchObject({ status: "partial", title: "Наушники Sony", priceKopecks: null, imageUrl: "https://avatars.mds.yandex.net/i.jpg" });
  });

  test("Ozon: does not fetch, takes the title from the slug", async () => {
    const { calls, fetchPage } = fakeFetch({});
    const result = await parseProduct("https://www.ozon.ru/product/dyuna-frenk-gerbert-1234567/", { fetchPage });
    expect(calls).toEqual([]);
    expect(result).toEqual({
      status: "partial",
      store: "ozon",
      finalUrl: "https://www.ozon.ru/product/dyuna-frenk-gerbert-1234567/",
      title: "Dyuna frenk gerbert",
      description: null,
      imageUrl: null,
      priceKopecks: null,
      currency: null,
    });
  });

  test("short link: follows to Wildberries and refetches with the messenger UA", async () => {
    const short = "https://clck.ru/3Abcd";
    const blocked: FetchedPage = { ok: false, reason: "http_error", status: 498 };
    const { calls, fetchPage } = fakeFetch({
      [short]: html(WB, "<html></html>"),
      [WB]: (userAgent) => (userAgent === MESSENGER_USER_AGENT ? html(WB, readFixture("wildberries.html")) : blocked),
    });
    const result = await parseProduct(short, { fetchPage });
    expect(calls).toEqual([
      { url: short, userAgent: LINK_PREVIEW_USER_AGENT },
      { url: WB, userAgent: MESSENGER_USER_AGENT },
    ]);
    expect(result).toMatchObject({ status: "ok", store: "wildberries", finalUrl: WB });
  });

  test("short link to Ozon ends with the slug title, without extracting the antibot page", async () => {
    const short = "https://clck.ru/3Ozon";
    const ozon = "https://www.ozon.ru/product/svecha-aromaticheskaya-555555/";
    const { fetchPage } = fakeFetch({ [short]: html(ozon, '<meta property="og:title" content="Доступ ограничен">') });
    expect(await parseProduct(short, { fetchPage })).toMatchObject({ status: "partial", store: "ozon", title: "Svecha aromaticheskaya" });
  });

  test("any other shop: OpenGraph with price is ok, unreachable page fails", async () => {
    const shop = "https://shop.example.ru/candle";
    const { fetchPage } = fakeFetch({
      [shop]: html(shop, '<meta property="og:title" content="Свеча"><meta property="product:price:amount" content="990"><meta property="og:image" content="/c.jpg">'),
    });
    expect(await parseProduct(shop, { fetchPage })).toMatchObject({ status: "ok", title: "Свеча", priceKopecks: 99000, imageUrl: "https://shop.example.ru/c.jpg" });
    expect(await parseProduct("https://down.example.ru/x", { fetchPage })).toMatchObject({ status: "failed", title: null, store: "other" });
  });

  test("invalid link fails without fetching and waits its turn before each request", async () => {
    const { calls, fetchPage } = fakeFetch({});
    const waited: string[] = [];
    expect(await parseProduct("javascript:alert(1)", { fetchPage })).toMatchObject({ status: "failed", store: "other" });
    await parseProduct("https://down.example.ru/x", { fetchPage, waitTurn: async (url) => void waited.push(url) });
    expect(calls).toHaveLength(1);
    expect(waited).toEqual(["https://down.example.ru/x"]);
  });
});
```

Run: `pnpm vitest run packages/parser/src/pipeline.test.ts`
Expected: FAIL — `Cannot find module './pipeline'`.

- [ ] **Step 4: Пайплайн (реализация)**

`packages/parser/src/pipeline.ts`:
```ts
import { detectStore, normalizeProductUrl, type StoreId } from "@wishlist/core";
import { extractJsonLdProduct } from "./extract/jsonld";
import { extractMicrodata } from "./extract/microdata";
import { extractOpenGraph } from "./extract/opengraph";
import { parseHtml } from "./html";
import { mergeProduct, statusFor } from "./merge";
import { titleFromUrlSlug } from "./slug-title";
import { STORE_STRATEGIES } from "./strategies";
import { EMPTY_PRODUCT, type FetchedPage, type FetchPage, type ParseResult } from "./types";

export type ParseDeps = { fetchPage: FetchPage; waitTurn?: (url: string) => Promise<void> };

function fromSlug(url: string, store: StoreId): ParseResult {
  const title = titleFromUrlSlug(url, store);
  return { ...EMPTY_PRODUCT, title, status: title ? "partial" : "failed", finalUrl: url, store };
}

function fromPage(url: string, body: string, store: StoreId): ParseResult {
  const root = parseHtml(body);
  const merged = mergeProduct(url, [extractJsonLdProduct(root), extractMicrodata(root), extractOpenGraph(root)]);
  const priced = STORE_STRATEGIES[store].trustPrice ? merged : { ...merged, priceKopecks: null, currency: null };
  const product = priced.title ? priced : { ...priced, title: titleFromUrlSlug(url, store) };
  return { ...product, status: statusFor(product), finalUrl: url, store };
}

async function load(url: string, userAgent: string, deps: ParseDeps): Promise<FetchedPage> {
  await deps.waitTurn?.(url);
  return deps.fetchPage(url, { userAgent });
}

export async function parseProduct(rawUrl: string, deps: ParseDeps): Promise<ParseResult> {
  const url = normalizeProductUrl(rawUrl);
  if (!url) return { ...EMPTY_PRODUCT, status: "failed", finalUrl: rawUrl, store: "other" };

  const store = detectStore(url).id;
  const strategy = STORE_STRATEGIES[store];
  if (!strategy.fetch) return fromSlug(url, store);

  const page = await load(url, strategy.userAgent, deps);
  if (!page.ok) return fromSlug(url, store);

  const finalUrl = normalizeProductUrl(page.url) ?? url;
  const finalStore = detectStore(finalUrl).id;
  if (finalStore === store) return fromPage(finalUrl, page.body, store);

  const finalStrategy = STORE_STRATEGIES[finalStore];
  if (!finalStrategy.fetch) return fromSlug(finalUrl, finalStore);
  if (finalStrategy.userAgent === strategy.userAgent) return fromPage(finalUrl, page.body, finalStore);

  const refetched = await load(finalUrl, finalStrategy.userAgent, deps);
  return refetched.ok ? fromPage(finalUrl, refetched.body, finalStore) : fromSlug(finalUrl, finalStore);
}
```

Run: `pnpm vitest run packages/parser/src/pipeline.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Экспорт, проверка, commit**

В `packages/parser/src/index.ts` добавить строки:
```ts
export * from "./strategies";
export * from "./slug-title";
export * from "./pipeline";
```

Run: `pnpm vitest run packages/parser && pnpm typecheck`
Expected: PASS.

```bash
git add packages/parser
git commit -m "feat(parser): store strategies and parseProduct pipeline"
```

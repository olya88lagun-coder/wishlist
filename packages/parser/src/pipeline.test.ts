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

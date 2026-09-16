import type { ParseResult } from "@wishlist/parser";
import { describe, expect, test } from "vitest";
import { CANARY_URLS, checkHealth, createUptimeMonitor, runCanary, UPTIME_FAILURES_TO_ALERT } from "./monitoring";

const ok = (url: string): ParseResult => ({
  status: "ok",
  store: "wildberries",
  finalUrl: url,
  title: "Товар",
  description: null,
  imageUrl: "https://img/1.webp",
  priceKopecks: 100,
  currency: "RUB",
});

describe("runCanary", () => {
  test("checks one real link per store and stays silent when all parse fully", async () => {
    const alerts: string[] = [];
    const parsed: string[] = [];
    const result = await runCanary({
      parse: async (url) => (parsed.push(url), ok(url)),
      alert: async (text) => void alerts.push(text),
      log: () => undefined,
    });
    expect(parsed).toEqual([...CANARY_URLS]);
    expect(CANARY_URLS.map((u) => new URL(u).hostname)).toEqual(["www.wildberries.ru", "goldapple.ru", "market.yandex.ru"]);
    expect(result.failures).toEqual([]);
    expect(alerts).toEqual([]);
  });

  test("one alert lists every broken store, including missing photos and crashes", async () => {
    const alerts: string[] = [];
    const result = await runCanary({
      parse: async (url) => {
        if (url.includes("goldapple")) return { ...ok(url), imageUrl: null };
        if (url.includes("market")) throw new Error("boom");
        return { ...ok(url), status: "partial", priceKopecks: null };
      },
      alert: async (text) => void alerts.push(text),
      log: () => undefined,
    });
    expect(result.failures).toHaveLength(3);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain("⚠️ Canary парсера");
    expect(alerts[0]).toContain("www.wildberries.ru — partial");
    expect(alerts[0]).toContain("goldapple.ru — без фото");
    expect(alerts[0]).toContain("market.yandex.ru — ошибка");
  });
});

describe("uptime monitor", () => {
  test("alerts after consecutive failures and once on recovery", async () => {
    const alerts: string[] = [];
    let healthy = true;
    const monitor = createUptimeMonitor({ check: async () => healthy, alert: async (text) => void alerts.push(text), log: () => undefined });
    await monitor.tick();
    healthy = false;
    for (let i = 0; i < UPTIME_FAILURES_TO_ALERT + 3; i++) await monitor.tick();
    expect(alerts).toEqual(["🔴 Сайт не отвечает: /api/health — 2 проверки подряд"]);
    healthy = true;
    await monitor.tick();
    await monitor.tick();
    expect(alerts).toEqual(["🔴 Сайт не отвечает: /api/health — 2 проверки подряд", "🟢 Сайт снова отвечает"]);
  });

  test("a single failure is not reported", async () => {
    const alerts: string[] = [];
    const results = [false, true, false, true];
    const monitor = createUptimeMonitor({
      check: async () => results.shift() ?? true,
      alert: async (text) => void alerts.push(text),
      log: () => undefined,
    });
    for (let i = 0; i < 4; i++) await monitor.tick();
    expect(alerts).toEqual([]);
  });
});

test("checkHealth treats non-2xx, network errors and timeouts as down", async () => {
  expect(await checkHealth("https://my-wish-list.online", async () => new Response("{}", { status: 200 }))).toBe(true);
  expect(await checkHealth("https://my-wish-list.online", async () => new Response("", { status: 502 }))).toBe(false);
  expect(
    await checkHealth("https://my-wish-list.online", async () => {
      throw new Error("ECONNREFUSED");
    }),
  ).toBe(false);
});

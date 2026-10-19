import { expect, test } from "@playwright/test";
import { captureGoals, captureMetrikaRequests } from "./analytics-counter";

test("QA URL makes zero Metrika requests on its page and subsequent navigations", async ({ page, context }) => {
  const requests = await captureMetrikaRequests(context);
  await page.goto("/articles/kak-sostavit-vishlist?analytics_test=1");
  // Ждём выполнения lazyOnload: отсутствие запросов до этой точки ничего не доказывает.
  await page.waitForFunction(() => typeof window.__wlLoadMetrika === "function");
  expect(await page.evaluate(() => window.__wlAnalyticsTestTraffic)).toBe(true);
  expect(await page.evaluate(() => window.__wlMetrikaStarted)).not.toBe(true);
  await expect(page.locator('script[src*="mc.yandex"]')).toHaveCount(0);
  expect(requests).toEqual([]);

  await page.getByRole("region", { name: "Подборка по теме статьи" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/gifts$/);
  expect(await page.evaluate(() => window.__wlAnalyticsTestTraffic)).toBe(true);
  expect(requests).toEqual([]);

  await page.goto("/articles");
  await page.waitForFunction(() => typeof window.__wlLoadMetrika === "function");
  await expect(page.locator('script[src*="mc.yandex"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.sessionStorage.getItem("wl_analytics_test"))).toBe("1");
  expect(requests).toEqual([]);
});

test("query-only explicit reset starts the normal counter once", async ({ page, context }) => {
  await captureGoals(context);
  await page.goto("/articles?analytics_test=1");
  await page.waitForFunction(() => typeof window.__wlLoadMetrika === "function");
  await expect(page.locator('script[src*="mc.yandex"]')).toHaveCount(0);
  await page.evaluate(() => window.history.pushState(null, "", "?analytics_test=0"));
  await page.waitForFunction(() => window.__wlMetrikaReady === true);
  await expect(page.locator('script[src*="mc.yandex"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.__wlAnalyticsTestTraffic)).toBe(false);
  expect(await page.evaluate(() => window.sessionStorage.getItem("wl_analytics_test"))).toBeNull();
  await page.evaluate(() => window.history.replaceState(null, "", "?other=1"));
  await expect(page.locator('script[src*="mc.yandex"]')).toHaveCount(1);

  await page.evaluate(() => {
    window.sessionStorage.setItem("wl_metrika_queue_112836417", JSON.stringify([
      { event: "wishlist_created", params: { source: "direct" }, at: Date.now() },
    ]));
    window.history.pushState(null, "", "?analytics_test=1");
  });
  await expect.poll(() => page.evaluate(() => window.__wlAnalyticsTestTraffic)).toBe(true);
  expect(await page.evaluate(() => window.sessionStorage.getItem("wl_metrika_queue_112836417"))).toBeNull();
  expect(await page.evaluate(() => window.__wlMetrikaStarted)).toBe(false);
  expect(await page.evaluate(() => window.__wlMetrikaReady)).toBe(false);
  await page.evaluate(() => window.history.replaceState(null, "", "?analytics_test=0"));
  await page.waitForFunction(() => window.__wlMetrikaReady === true);
  await expect(page.locator('script[src*="mc.yandex"]')).toHaveCount(1);
});

test("QA remains isolated through query changes when session storage is blocked", async ({ page, context }) => {
  const requests = await captureMetrikaRequests(context);
  await context.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new Error("blocked"); } });
  });
  await page.goto("/articles?analytics_test=1");
  await page.waitForFunction(() => typeof window.__wlLoadMetrika === "function");
  await page.evaluate(() => window.history.pushState(null, "", "?other=1"));
  await expect.poll(() => page.evaluate(() => window.__wlAnalyticsTestTraffic)).toBe(true);
  await expect(page.locator('script[src*="mc.yandex"]')).toHaveCount(0);
  expect(requests).toEqual([]);
});

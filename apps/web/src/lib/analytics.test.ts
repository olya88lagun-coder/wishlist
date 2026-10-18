import { afterEach, beforeEach, expect, test, vi } from "vitest";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
let tabStorage: MemoryStorage;
function browser(storage = tabStorage) {
  const page = Object.assign(new EventTarget(), { sessionStorage: storage, location: new URL("https://my-wish-list.online/gifts"), ym: undefined as ReturnType<typeof vi.fn> | undefined });
  vi.stubGlobal("window", page);
  vi.stubGlobal("document", new EventTarget());
  return page;
}
beforeEach(() => { vi.resetModules(); tabStorage = new MemoryStorage(); browser(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

test("an early click waits for counter readiness and is sent exactly once", async () => {
  const { trackEvent } = await import("./analytics");
  trackEvent("guest_wishlist_cta_click", { destination: "site", placement: "after_reservation" });
  const ym = vi.fn();
  window.ym = ym;
  expect(ym).not.toHaveBeenCalled();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(ym).toHaveBeenCalledExactlyOnceWith(112836417, "reachGoal", "guest_wishlist_cta_click", { destination: "site", placement: "after_reservation" });
});

test("an early navigation keeps the click for the next document", async () => {
  (await import("./analytics")).trackEvent("guest_wishlist_cta_click", { destination: "site" });
  vi.resetModules();
  const page = browser(tabStorage);
  page.ym = vi.fn();
  (await import("./analytics")).trackEvent("landing_gift_finder_click");
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(page.ym.mock.calls.map((call) => call[2])).toEqual(["guest_wishlist_cta_click", "landing_gift_finder_click"]);
});

test("restoring a cached document does not replay a goal already sent by the next document", async () => {
  const firstPage = browser();
  const firstDocument = document;
  const firstModule = await import("./analytics");
  firstModule.trackEvent("guest_wishlist_cta_click", { destination: "site" });
  vi.resetModules();
  const secondPage = browser(tabStorage);
  secondPage.ym = vi.fn();
  (await import("./analytics")).initializeAnalytics();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(secondPage.ym).toHaveBeenCalledTimes(1);
  vi.stubGlobal("window", firstPage);
  vi.stubGlobal("document", firstDocument);
  firstPage.ym = vi.fn();
  firstPage.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  firstDocument.dispatchEvent(new Event("yacounter112836417inited"));
  expect(firstPage.ym).not.toHaveBeenCalled();
});

test("a ready counter receives subsequent actions without buffering", async () => {
  const { trackEvent } = await import("./analytics");
  window.ym = vi.fn();
  trackEvent("gift_finder_submit", { person: "mom", budget: "1000" });
  document.dispatchEvent(new Event("yacounter112836417inited"));
  trackEvent("gift_finder_result", { count: 5, source: "ai" });
  expect(window.ym).toHaveBeenCalledTimes(2);
});

test("a cached document that only loaded the queue does not replay goals drained elsewhere", async () => {
  tabStorage.setItem("wl_metrika_queue_112836417", JSON.stringify([
    { event: "guest_wishlist_cta_click", at: Date.now(), params: { destination: "site" } },
  ]));
  const firstPage = browser();
  const firstDocument = document;
  (await import("./analytics")).initializeAnalytics();
  vi.resetModules();
  const secondPage = browser(tabStorage);
  secondPage.ym = vi.fn();
  (await import("./analytics")).initializeAnalytics();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(secondPage.ym).toHaveBeenCalledTimes(1);
  vi.stubGlobal("window", firstPage);
  vi.stubGlobal("document", firstDocument);
  firstPage.ym = vi.fn();
  firstPage.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  firstDocument.dispatchEvent(new Event("yacounter112836417inited"));
  expect(firstPage.ym).not.toHaveBeenCalled();
});

test("marks a direct login test before its first completion event", async () => {
  const module = await import("./analytics");
  window.location.search = "?analytics_test=1";
  module.initializeAnalytics();
  vi.resetModules();
  const page = browser(tabStorage);
  page.ym = vi.fn();
  (await import("./analytics")).trackEvent("auth_completed", { provider: "vk" });
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(page.ym).toHaveBeenCalledWith(112836417, "reachGoal", "auth_completed", { provider: "vk", test_traffic: true });
});

test("keeps analytics optional when tab storage and the counter fail", async () => {
  const page = browser();
  page.sessionStorage.getItem = () => { throw new Error("blocked"); };
  page.sessionStorage.setItem = () => { throw new Error("blocked"); };
  page.ym = vi.fn(() => { throw new Error("counter blocked"); });
  const { trackEvent } = await import("./analytics");
  expect(() => trackEvent("wishlist_reserved")).not.toThrow();
  expect(() => document.dispatchEvent(new Event("yacounter112836417inited"))).not.toThrow();
  page.ym = vi.fn();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(page.ym).toHaveBeenCalledTimes(1);
});

test("bounds the queue and expires events while waiting for the counter", async () => {
  const { trackEvent } = await import("./analytics");
  for (let i = 0; i < 110; i++) trackEvent("gift_finder_result", { count: i });
  window.ym = vi.fn();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(window.ym).toHaveBeenCalledTimes(100);
  expect(vi.mocked(window.ym!).mock.calls[0]?.[3]).toEqual({ count: 10 });
});

test("drops expired and malformed persisted events without sending private fields", async () => {
  tabStorage.setItem("wl_metrika_queue_112836417", JSON.stringify([
    { event: "auth_completed", at: Date.now() - 601_000 },
    { event: "unknown", at: Date.now() },
    { event: "wishlist_created", at: Date.now(), params: { source: "direct", title: "Личный список", token: "secret", email: "private@example.com" } },
  ]));
  window.ym = vi.fn();
  (await import("./analytics")).initializeAnalytics();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(window.ym).toHaveBeenCalledExactlyOnceWith(112836417, "reachGoal", "wishlist_created", { source: "direct" });
  expect(tabStorage.getItem("wl_metrika_queue_112836417")).toBeNull();
});

test("normalizes a free-form budget and strips unknown personal fields", async () => {
  window.ym = vi.fn();
  const { trackEvent } = await import("./analytics");
  trackEvent("gift_finder_submit", { budget: "Напишите на private@example.com", interests: "Личные данные", name: "Имя" });
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(window.ym).toHaveBeenCalledExactlyOnceWith(112836417, "reachGoal", "gift_finder_submit", { budget: "custom" });
});

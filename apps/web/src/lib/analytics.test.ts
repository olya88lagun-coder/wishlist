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

test("design goals keep the selected theme and submitted product in the delivery queue", async () => {
  const { trackEvent } = await import("./analytics");
  trackEvent("design_theme_select", { theme: "new-year" });
  trackEvent("design_theme_pay_click", { theme: "new-year", product: "new_year" });
  const queued = JSON.parse(tabStorage.getItem("wl_metrika_queue_112836417") ?? "[]");
  expect(queued.map(({ event, params }: { event: string; params: unknown }) => ({ event, params }))).toEqual([
    { event: "design_theme_select", params: { theme: "new-year" } },
    { event: "design_theme_pay_click", params: { theme: "new-year", product: "new_year" } },
  ]);
});

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

test("initialization drains a queue when inline readiness preceded React mounting", async () => {
  tabStorage.setItem("wl_metrika_queue_112836417", JSON.stringify([
    { event: "wishlist_created", params: { source: "finder" }, at: Date.now() },
  ]));
  window.ym = vi.fn();
  window.__wlMetrikaReady = true;
  const { initializeAnalytics } = await import("./analytics");
  initializeAnalytics();
  initializeAnalytics();
  expect(window.ym).toHaveBeenCalledExactlyOnceWith(112836417, "reachGoal", "wishlist_created", { source: "finder" });
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

test("QA traffic stays isolated after full navigation before a completion", async () => {
  const module = await import("./analytics");
  window.location.search = "?analytics_test=1";
  module.initializeAnalytics();
  vi.resetModules();
  const page = browser(tabStorage);
  page.ym = vi.fn();
  (await import("./analytics")).trackEvent("auth_completed", { provider: "vk" });
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(page.ym).not.toHaveBeenCalled();
  expect(tabStorage.getItem("wl_metrika_queue_112836417")).toBeNull();
});

test("enabling QA clears early normal events and never queues QA goals", async () => {
  const { initializeAnalytics, trackEvent } = await import("./analytics");
  trackEvent("guest_wishlist_cta_click", { destination: "site" });
  expect(tabStorage.getItem("wl_metrika_queue_112836417")).not.toBeNull();
  window.location.search = "?analytics_test=1";
  initializeAnalytics();
  trackEvent("wishlist_created", { source: "direct" });
  window.ym = vi.fn();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(window.ym).not.toHaveBeenCalled();
  expect(tabStorage.getItem("wl_metrika_queue_112836417")).toBeNull();
});

test("explicit reset resumes normal goals without replaying discarded QA events", async () => {
  const { trackEvent } = await import("./analytics");
  window.location.search = "?analytics_test=1";
  window.ym = vi.fn();
  trackEvent("wishlist_reserved");
  document.dispatchEvent(new Event("yacounter112836417inited"));
  window.location.search = "?analytics_test=0";
  trackEvent("wishlist_created", { source: "direct" });
  window.__wlMetrikaStarted = true;
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(window.ym).toHaveBeenCalledExactlyOnceWith(112836417, "reachGoal", "wishlist_created", { source: "direct" });
});

test("legacy QA goals are discarded while ordinary persisted goals still arrive", async () => {
  tabStorage.setItem("wl_metrika_queue_112836417", JSON.stringify([
    { event: "auth_completed", at: Date.now(), params: { provider: "vk", test_traffic: true } },
    { event: "wishlist_created", at: Date.now(), params: { source: "direct" } },
  ]));
  window.ym = vi.fn();
  (await import("./analytics")).initializeAnalytics();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(window.ym).toHaveBeenCalledExactlyOnceWith(112836417, "reachGoal", "wishlist_created", { source: "direct" });
});

test("QA suppression survives blocked storage and query-only navigation", async () => {
  const page = browser();
  page.sessionStorage.getItem = () => { throw new Error("blocked"); };
  page.sessionStorage.setItem = () => { throw new Error("blocked"); };
  page.sessionStorage.removeItem = () => { throw new Error("blocked"); };
  page.ym = vi.fn();
  const { trackEvent } = await import("./analytics");
  page.location.search = "?analytics_test=1";
  trackEvent("wishlist_reserved");
  page.location.search = "?other=1";
  document.dispatchEvent(new Event("yacounter112836417inited"));
  trackEvent("wishlist_created");
  expect(page.ym).not.toHaveBeenCalled();
  page.location.search = "?analytics_test=0";
  trackEvent("wishlist_reserved");
  window.__wlMetrikaStarted = true;
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(page.ym).toHaveBeenCalledExactlyOnceWith(112836417, "reachGoal", "wishlist_reserved", undefined);
});

test("normal-to-QA stops the active counter and late readiness never reopens QA goals", async () => {
  const { initializeAnalytics, trackEvent } = await import("./analytics");
  window.ym = vi.fn();
  window.__wlMetrikaStarted = true;
  initializeAnalytics();
  document.dispatchEvent(new Event("yacounter112836417inited"));
  window.location.search = "?analytics_test=1";
  initializeAnalytics();
  trackEvent("wishlist_created", { source: "direct" });
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(window.ym).toHaveBeenCalledExactlyOnceWith(112836417, "destruct");
  expect(window.__wlMetrikaReady).toBe(false);
  expect(window.__wlMetrikaStarted).toBe(false);
  window.location.search = "?analytics_test=0";
  trackEvent("wishlist_reserved");
  expect(window.ym).toHaveBeenCalledTimes(1);
  window.__wlMetrikaStarted = true;
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(window.ym).toHaveBeenLastCalledWith(112836417, "reachGoal", "wishlist_reserved", undefined);
  expect(window.ym).toHaveBeenCalledTimes(2);
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

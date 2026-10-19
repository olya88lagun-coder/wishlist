import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";
import { isAnalyticsTestTraffic, metrikaLoaderScript, stopMetrikaForTestTraffic } from "./analytics-test-traffic";

function tab(search = "") {
  const storage = new Map<string, string>();
  return {
    location: { search, href: `https://my-wish-list.online/gifts${search}` },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
    __wlAnalyticsTestTraffic: undefined as boolean | undefined,
    __wlAnalyticsTestTrafficStorageFailed: undefined as boolean | undefined,
    __wlLoadMetrika: undefined as (() => void) | undefined,
    __wlMetrikaStarted: undefined as boolean | undefined,
    __wlMetrikaReady: undefined as boolean | undefined,
    ym: undefined as ReturnType<typeof vi.fn> | undefined,
  };
}

test("URL opt-in persists for later pages and URL zero explicitly clears it", () => {
  const page = tab("?analytics_test=1");
  expect(isAnalyticsTestTraffic(page)).toBe(true);
  page.location.search = "";
  expect(isAnalyticsTestTraffic(page)).toBe(true);
  const nextPage = { ...tab(), sessionStorage: page.sessionStorage };
  expect(isAnalyticsTestTraffic(nextPage)).toBe(true);
  nextPage.location.search = "?analytics_test=0";
  expect(isAnalyticsTestTraffic(nextPage)).toBe(false);
  nextPage.location.search = "";
  expect(isAnalyticsTestTraffic(nextPage)).toBe(false);
});

test("memory preserves QA and an explicit reset when storage writes are blocked", () => {
  const page = tab("?analytics_test=1");
  page.sessionStorage.setItem = () => { throw new Error("blocked"); };
  page.sessionStorage.removeItem = () => { throw new Error("blocked"); };
  expect(isAnalyticsTestTraffic(page)).toBe(true);
  page.location.search = "";
  expect(isAnalyticsTestTraffic(page)).toBe(true);
  page.location.search = "?analytics_test=0";
  expect(isAnalyticsTestTraffic(page)).toBe(false);
  page.location.search = "";
  expect(isAnalyticsTestTraffic(page)).toBe(false);
});

test("a restored document reads a reset saved by another document in the same tab", () => {
  const page = tab("?analytics_test=1");
  expect(isAnalyticsTestTraffic(page)).toBe(true);
  page.location.search = "";
  const otherDocument = { ...tab("?analytics_test=0"), sessionStorage: page.sessionStorage };
  expect(isAnalyticsTestTraffic(otherDocument)).toBe(false);
  expect(isAnalyticsTestTraffic(page)).toBe(false);
});

function loader(page = tab(), readyDuringInit = false) {
  const anchor = { parentNode: { insertBefore: vi.fn() } };
  const document = Object.assign(new EventTarget(), { scripts: [] as { src?: string }[], referrer: "", createElement: vi.fn(() => ({})), getElementsByTagName: () => [anchor] });
  if (readyDuringInit) page.ym = vi.fn((_id: number, action: string) => {
    if (action === "init") document.dispatchEvent(new Event("yacounter112836417inited"));
  });
  anchor.parentNode.insertBefore.mockImplementation((script: { src?: string }) => { document.scripts.push(script); });
  const scope = { window: page, document, URLSearchParams, Date };
  runInNewContext(metrikaLoaderScript(112836417), scope);
  return { page, document, anchor };
}

test("the inline loader remembers readiness before the React listener mounts", () => {
  const { page, document } = loader(tab(), true);
  expect(page.__wlMetrikaReady).toBe(true);
  page.location.search = "?analytics_test=1";
  document.dispatchEvent(new Event("yacounter112836417inited"));
  expect(page.__wlMetrikaReady).toBe(false);
  expect(page.__wlMetrikaStarted).toBe(false);
});

test("the inline loader makes no script or init call in URL or inherited QA context", () => {
  const first = loader(tab("?analytics_test=1"));
  expect(first.document.createElement).not.toHaveBeenCalled();
  expect(first.page.ym).toBeUndefined();
  const next = loader({ ...tab(), sessionStorage: first.page.sessionStorage });
  expect(next.document.createElement).not.toHaveBeenCalled();
  expect(next.page.ym).toBeUndefined();
});

test("normal inline loading and an explicit QA reset initialize only once", () => {
  const { page, document } = loader(tab("?analytics_test=1"));
  page.location.search = "?analytics_test=0";
  page.__wlLoadMetrika!();
  page.__wlLoadMetrika!();
  expect(document.createElement).toHaveBeenCalledTimes(1);
  const queued = (page.ym as unknown as { a: unknown[][] }).a;
  expect(queued).toHaveLength(1);
  expect(Array.from(queued[0]!).slice(0, 2)).toEqual([112836417, "init"]);
  const normal = loader();
  expect(normal.document.createElement).toHaveBeenCalledTimes(1);
});

test("entering QA stops an active counter and explicit reset initializes it once again", () => {
  const page = tab();
  let automaticTracking = false;
  page.ym = vi.fn((_id: number, action: string) => {
    if (action === "init") { automaticTracking = true; page.__wlMetrikaReady = true; }
    if (action === "destruct") automaticTracking = false;
  });
  const { document } = loader(page);
  expect(automaticTracking).toBe(true);
  page.location.search = "?analytics_test=1";
  page.__wlLoadMetrika!();
  page.__wlLoadMetrika!();
  expect(automaticTracking).toBe(false);
  expect(page.__wlMetrikaStarted).toBe(false);
  expect(page.__wlMetrikaReady).toBe(false);
  expect(page.ym.mock.calls.map((call) => call[1])).toEqual(["init", "destruct"]);
  page.location.search = "?analytics_test=0";
  page.__wlLoadMetrika!();
  page.__wlLoadMetrika!();
  expect(automaticTracking).toBe(true);
  expect(page.ym.mock.calls.map((call) => call[1])).toEqual(["init", "destruct", "init"]);
  expect(document.createElement).toHaveBeenCalledTimes(1);
});

test("QA cancels a delayed init without queuing a destruct that could kill the next init", () => {
  const { page, document } = loader();
  const stub = page.ym as unknown as { a: unknown[][] };
  stub.a.push([112836417, "reachGoal", "wishlist_created"], [999, "init", {}]);
  page.location.search = "?analytics_test=1";
  page.__wlLoadMetrika!();
  expect(stub.a.map((call) => Array.from(call))).toEqual([[999, "init", {}]]);
  expect(page.__wlMetrikaStarted).toBe(false);
  expect(page.__wlMetrikaReady).toBe(false);
  page.location.search = "?analytics_test=0";
  page.__wlLoadMetrika!();
  const ownCalls = stub.a.filter((call) => call[0] === 112836417);
  expect(ownCalls).toHaveLength(1);
  expect(ownCalls[0]![1]).toBe("init");
  expect(document.createElement).toHaveBeenCalledTimes(1);
});

test("stopping an active ym.a-backed counter removes its buffered calls and preserves other counters", () => {
  const buffered = [[112836417, "init"], [112836417, "reachGoal", "wishlist_created"], [999, "init"]];
  const ym = Object.assign(vi.fn(), { a: buffered });
  const page = { ...tab(), ym, __wlMetrikaStarted: true, __wlMetrikaReady: true };
  stopMetrikaForTestTraffic(112836417, page);
  stopMetrikaForTestTraffic(112836417, page);
  expect(ym).toHaveBeenCalledExactlyOnceWith(112836417, "destruct");
  expect(ym.a).toBe(buffered);
  expect(buffered).toEqual([[999, "init"]]);
  expect(page.__wlMetrikaStarted).toBe(false);
  expect(page.__wlMetrikaReady).toBe(false);
});

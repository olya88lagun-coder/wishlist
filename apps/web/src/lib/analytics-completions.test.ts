import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("./analytics", () => ({ trackEvent: vi.fn() }));
import { trackEvent } from "./analytics";
import { collectAnalyticsCompletions } from "./analytics-completions";
import { completionCookie } from "@/server/analytics-completion";

let jar: Map<string, string>;
beforeEach(() => {
  vi.clearAllMocks();
  jar = new Map([["wl_session", "dummy-session"]]);
  const doc = {};
  Object.defineProperty(doc, "cookie", {
    get: () => [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
    set: (value: string) => { if (value.includes("Max-Age=0")) jar.delete(value.split("=")[0]!); },
  });
  vi.stubGlobal("document", doc);
});
afterEach(() => vi.unstubAllGlobals());

test("a completion survives different server and browser clocks", () => {
  const cookie = completionCookie({ event: "auth_completed", params: { provider: "telegram" } });
  jar.set(cookie.name, encodeURIComponent(cookie.value));
  const browserNow = Date.now() - 60_000;
  const clock = vi.spyOn(Date, "now").mockReturnValue(browserNow);
  try {
    collectAnalyticsCompletions();
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith("auth_completed", { provider: "telegram" });
  } finally { clock.mockRestore(); }
});

test("consumes auth and list completions once and preserves the session cookie", () => {
  for (const cookie of [completionCookie({ event: "auth_completed", params: { provider: "vk" } }), completionCookie({ event: "wishlist_created", params: { source: "finder" } })]) jar.set(cookie.name, encodeURIComponent(cookie.value));
  collectAnalyticsCompletions();
  collectAnalyticsCompletions();
  expect(trackEvent).toHaveBeenCalledTimes(2);
  expect(trackEvent).toHaveBeenNthCalledWith(1, "auth_completed", { provider: "vk" });
  expect(trackEvent).toHaveBeenNthCalledWith(2, "wishlist_created", { source: "finder" });
  expect(jar).toEqual(new Map([["wl_session", "dummy-session"]]));
});
test("completion cookie expires in five minutes and contains only event metadata", () => {
  const cookie = completionCookie({ event: "auth_completed", params: { provider: "vk" } });
  expect(cookie.maxAge).toBe(300);
  expect(JSON.parse(cookie.value)).toEqual({ event: "auth_completed", params: { provider: "vk" } });
});
test.each([null, { event: "auth_completed", params: { provider: "other" } }, { event: "unknown", params: { source: "direct" } }, { event: "wishlist_created", params: { source: "private-list" } }])("ignores malformed or unsupported completion %s", (value) => {
  jar.set(`wl_goal_${"a".repeat(32)}`, encodeURIComponent(JSON.stringify(value)));
  expect(() => collectAnalyticsCompletions()).not.toThrow();
  expect(trackEvent).not.toHaveBeenCalled();
});

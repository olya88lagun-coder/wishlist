import { beforeEach, expect, test, vi } from "vitest";
vi.mock("./analytics", () => ({ trackEvent: vi.fn() }));
import { trackEvent } from "./analytics";
import { withActionAnalytics } from "./action-analytics";
beforeEach(() => vi.clearAllMocks());

test("records one completion only after the action succeeds", async () => {
  let finish!: (value: { status: string }) => void;
  const action = withActionAnalytics(() => new Promise<{ status: string }>((resolve) => { finish = resolve; }), "wishlist_item_added", { source: "manual" });
  const response = action({ status: "idle" }, new FormData());
  expect(trackEvent).not.toHaveBeenCalled();
  const result = { status: "success" };
  finish(result);
  expect(await response).toBe(result);
  expect(trackEvent).toHaveBeenCalledExactlyOnceWith("wishlist_item_added", { source: "manual" });
});
test("does not count validation errors or rejected requests", async () => {
  const failed = { status: "error" };
  expect(await withActionAnalytics(async () => failed, "wishlist_reserved")({ status: "idle" }, new FormData())).toBe(failed);
  await expect(withActionAnalytics<{ status: string }>(async () => { throw new Error("network"); }, "wishlist_reserved")({ status: "idle" }, new FormData())).rejects.toThrow("network");
  expect(trackEvent).not.toHaveBeenCalled();
});

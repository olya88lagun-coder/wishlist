import { describe, expect, test } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  test("allows up to the limit per key within a window, then resets", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([true, true, false]);
    expect(limiter.allow("b")).toBe(true);
    now = 1000;
    expect(limiter.allow("a")).toBe(true);
  });
});

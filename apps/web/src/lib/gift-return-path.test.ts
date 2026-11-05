import { describe, expect, test } from "vitest";
import { giftReturnPath, loginReturnPath } from "./gift-return-path";

test.each(["/gifts", "/gifts/under-1000", "/gifts/new-year"])("accepts gift destination %s", (path) => { expect(giftReturnPath(path)).toBe(path); });
test.each([undefined, null, ["/gifts"], "https://evil.example", "//evil.example", "/\\evil.example", "/gifts?next=//evil.example", "/gifts/%2f%2fevil.example", "/gifts/../api/auth/logout", "/api/auth/logout", "/gifts\n"])("rejects external and ambiguous destination %s", (path) => { expect(giftReturnPath(path)).toBeNull(); });

describe("loginReturnPath", () => {
  test("accepts gift pages and santa games, nothing else", () => {
    expect(loginReturnPath("/gifts/for-mom")).toBe("/gifts/for-mom");
    expect(loginReturnPath("/santa/new")).toBe("/santa/new");
    expect(loginReturnPath("/santa/123e4567-e89b-12d3-a456-426614174000")).toBe("/santa/123e4567-e89b-12d3-a456-426614174000");
    expect(loginReturnPath("/santa/me/token")).toBeNull();
    expect(loginReturnPath("/santa/123e4567-e89b-12d3-a456-426614174000/x")).toBeNull();
    expect(loginReturnPath("https://evil.example/santa/new")).toBeNull();
    expect(giftReturnPath("/santa/new")).toBeNull();
  });
});

import { describe, expect, test } from "vitest";
import { giftReturnPath, listCreationPath, loginReturnPath } from "./gift-return-path";

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

  test("accepts list creation that returns to a gift collection", () => {
    expect(listCreationPath("/gifts/new-year")).toBe("/lists?returnTo=%2Fgifts%2Fnew-year");
    expect(loginReturnPath("/lists?returnTo=%2Fgifts%2Fnew-year")).toBe("/lists?returnTo=%2Fgifts%2Fnew-year");
    expect(loginReturnPath("/lists")).toBeNull();
    expect(loginReturnPath("/lists?preset=ded-moroz")).toBe("/lists?preset=ded-moroz");
    expect(loginReturnPath("/lists?preset=ded-moroz&x=1")).toBeNull();
    expect(loginReturnPath("/lists?returnTo=/gifts/new-year")).toBeNull();
    expect(loginReturnPath("/lists?returnTo=%2F%2Fevil.example")).toBeNull();
    expect(loginReturnPath("/lists?returnTo=%2Fgifts%2Fnew-year&x=1")).toBeNull();
    expect(loginReturnPath("/lists?returnTo=%E0%A4%A")).toBeNull();
  });
});

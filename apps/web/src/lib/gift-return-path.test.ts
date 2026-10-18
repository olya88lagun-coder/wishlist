import { expect, test } from "vitest";
import { giftReturnPath } from "./gift-return-path";

test.each(["/gifts", "/gifts/under-1000", "/gifts/new-year"])("accepts gift destination %s", (path) => { expect(giftReturnPath(path)).toBe(path); });
test.each([undefined, null, ["/gifts"], "https://evil.example", "//evil.example", "/\\evil.example", "/gifts?next=//evil.example", "/gifts/%2f%2fevil.example", "/gifts/../api/auth/logout", "/api/auth/logout", "/gifts\n"])("rejects external and ambiguous destination %s", (path) => { expect(giftReturnPath(path)).toBeNull(); });

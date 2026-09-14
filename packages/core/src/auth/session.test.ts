import { describe, expect, test } from "vitest";
import { signOAuthState, signSession, verifyOAuthState, verifySession } from "./session";

const SECRET = "a".repeat(64);

describe("session tokens", () => {
  test("round-trips a user id", async () => {
    const token = await signSession("user-1", SECRET);
    expect(await verifySession(token, SECRET)).toBe("user-1");
  });

  test("returns null for a token signed with another secret", async () => {
    const token = await signSession("user-1", "b".repeat(64));
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  test("returns null for garbage", async () => {
    expect(await verifySession("not-a-jwt", SECRET)).toBeNull();
  });

  test("does not accept an oauth state token as a session", async () => {
    const stateToken = await signOAuthState({ state: "s", codeVerifier: "v", linkUserId: null }, SECRET);
    expect(await verifySession(stateToken, SECRET)).toBeNull();
  });
});

describe("oauth state tokens", () => {
  test("round-trips the payload", async () => {
    const payload = { state: "st-1", codeVerifier: "ver-1", linkUserId: "user-9" };
    const token = await signOAuthState(payload, SECRET);
    expect(await verifyOAuthState(token, SECRET)).toEqual(payload);
  });

  test("does not accept a session token as oauth state", async () => {
    const token = await signSession("user-1", SECRET);
    expect(await verifyOAuthState(token, SECRET)).toBeNull();
  });
});

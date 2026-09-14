import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { buildVkAuthorizeUrl, createPkcePair, exchangeVkCode, fetchVkUser } from "./vk";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createPkcePair", () => {
  test("challenge is base64url(sha256(verifier)) and verifier is 43+ url-safe chars", () => {
    const { codeVerifier, codeChallenge } = createPkcePair();
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(codeChallenge).toBe(createHash("sha256").update(codeVerifier).digest("base64url"));
  });

  test("generates a different verifier each time", () => {
    expect(createPkcePair().codeVerifier).not.toBe(createPkcePair().codeVerifier);
  });
});

describe("buildVkAuthorizeUrl", () => {
  test("contains all OAuth 2.1 PKCE parameters", () => {
    const url = new URL(
      buildVkAuthorizeUrl({ clientId: "123", redirectUri: "https://wishly.ru/api/auth/vk/callback", state: "st", codeChallenge: "ch" }),
    );
    expect(url.origin + url.pathname).toBe("https://id.vk.ru/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "123",
      redirect_uri: "https://wishly.ru/api/auth/vk/callback",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
      scope: "vkid.personal_info",
    });
  });
});

describe("exchangeVkCode", () => {
  test("posts form data to the token endpoint and returns the access token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "at-1", user_id: 777 }));
    const result = await exchangeVkCode({
      clientId: "123", redirectUri: "https://wishly.ru/cb", code: "c1", codeVerifier: "v1", deviceId: "d1", state: "st", fetchFn,
    });
    expect(result).toEqual({ ok: true, accessToken: "at-1" });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://id.vk.ru/oauth2/auth");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      grant_type: "authorization_code", code: "c1", code_verifier: "v1", client_id: "123", device_id: "d1", redirect_uri: "https://wishly.ru/cb", state: "st",
    });
  });

  test("returns the provider error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant", error_description: "code expired" }, 400));
    const result = await exchangeVkCode({ clientId: "1", redirectUri: "r", code: "c", codeVerifier: "v", deviceId: "d", state: "s", fetchFn });
    expect(result).toEqual({ ok: false, error: "invalid_grant" });
  });
});

describe("fetchVkUser", () => {
  test("maps the user_info response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ user: { user_id: "777", first_name: "Маша", last_name: "Иванова", avatar: "https://vk.ru/a.jpg" } }),
    );
    expect(await fetchVkUser({ clientId: "123", accessToken: "at-1", fetchFn })).toEqual({
      ok: true,
      user: { id: "777", firstName: "Маша", lastName: "Иванова", avatarUrl: "https://vk.ru/a.jpg" },
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://id.vk.ru/oauth2/user_info");
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({ access_token: "at-1", client_id: "123" });
  });

  test("fails on a malformed response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ user: {} }));
    expect(await fetchVkUser({ clientId: "1", accessToken: "a", fetchFn })).toEqual({ ok: false, error: "malformed_user_info" });
  });
});

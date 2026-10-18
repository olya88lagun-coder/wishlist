import { createHash, createHmac } from "node:crypto";
import { signOAuthState, signSession, verifySession } from "@wishlist/core";
import { createWishlist, getUserWithIdentities } from "@wishlist/db";
import { createTestDb } from "@wishlist/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type AuthDeps,
  finishVkLogin,
  getCurrentUser,
  loginWithTelegramInitData,
  loginWithTelegramWidget,
  startVkLogin,
  startTelegramLogin,
} from "./auth-service";
import type { AppEnv } from "./env";

const env: AppEnv = {
  APP_URL: "https://wishly.ru",
  DATABASE_URL: "unused",
  SESSION_SECRET: "s".repeat(64),
  TELEGRAM_BOT_TOKEN: "123456:TEST-TOKEN",
  TELEGRAM_BOT_USERNAME: "wishly_bot",
  VK_CLIENT_ID: "555",
};
const NOW = new Date("2026-09-14T12:00:00Z");
const nowSec = String(Math.floor(NOW.getTime() / 1000));

function dcs(fields: Record<string, string>) {
  return Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
}
function initData(user: object) {
  const fields = { auth_date: nowSec, user: JSON.stringify(user) };
  const secret = createHmac("sha256", "WebAppData").update(env.TELEGRAM_BOT_TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: createHmac("sha256", secret).update(dcs(fields)).digest("hex") }).toString();
}
function widgetParams(fields: Record<string, string>) {
  const secret = createHash("sha256").update(env.TELEGRAM_BOT_TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: createHmac("sha256", secret).update(dcs(fields)).digest("hex") });
}
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

let deps: AuthDeps;
beforeEach(async () => {
  deps = { db: await createTestDb(), env, now: () => NOW, fetchFn: vi.fn() };
});

async function vkLogin(vkId: string, currentSessionToken: string | null, returnTo?: string) {
  const started = await startVkLogin(deps, currentSessionToken, returnTo);
  const state = new URL(started.redirectUrl).searchParams.get("state");
  vi.mocked(deps.fetchFn)
    .mockResolvedValueOnce(json({ access_token: "at" }))
    .mockResolvedValueOnce(json({ user: { user_id: vkId, first_name: "Мария", avatar: "https://vk.ru/a.jpg" } }));
  const result = await finishVkLogin(deps, { code: "c", deviceId: "d", state, stateCookie: started.stateCookie, currentSessionToken });
  if (!result.ok) throw new Error(result.error);
  return { token: result.sessionToken, userId: result.userId, returnTo: result.returnTo };
}

async function widgetLogin(fields: Record<string, string>, token: string | null, returnTo?: string) {
  const started = await startTelegramLogin(deps, token, returnTo);
  const params = widgetParams(fields);
  params.set("state", new URL(started.authUrl).searchParams.get("state")!);
  return loginWithTelegramWidget(deps, params, token, started.stateCookie);
}

describe("loginWithTelegramInitData", () => {
  test("creates a user and returns a valid session", async () => {
    const result = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await verifySession(result.sessionToken, env.SESSION_SECRET)).toBe(result.userId);
    expect(await getCurrentUser(deps, result.sessionToken)).toMatchObject({ displayName: "Маша", providers: ["telegram"] });
  });

  test("rejects a forged payload", async () => {
    const forged = initData({ id: 42, first_name: "Маша" }).replace("42", "43");
    expect(await loginWithTelegramInitData(deps, forged)).toEqual({ ok: false, error: "telegram_BAD_HASH" });
  });
});

describe("loginWithTelegramWidget", () => {
  test("rejects a valid Telegram assertion without this browser's login intent", async () => {
    const owner = await vkLogin("777", null);
    const result = await loginWithTelegramWidget(deps, widgetParams({ id: "99", first_name: "Чужой", auth_date: nowSec }), owner.token);
    expect(result).toEqual({ ok: false, error: "telegram_state_mismatch" });
    expect((await getUserWithIdentities(deps.db, owner.userId))?.providers).toEqual(["vk"]);
  });
  test("logs in via widget and reuses the same user as the mini app", async () => {
    const viaMiniApp = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    const viaWidget = await widgetLogin({ id: "42", first_name: "Маша", auth_date: nowSec }, null);
    expect(viaWidget.ok && viaMiniApp.ok && viaWidget.userId === viaMiniApp.userId).toBe(true);
  });

  test("links telegram to the currently logged-in VK user", async () => {
    const vkUserSession = await vkLogin("777", null);
    const result = await widgetLogin({ id: "42", first_name: "Маша", auth_date: nowSec }, vkUserSession.token);
    expect(result).toMatchObject({ ok: true, userId: vkUserSession.userId });
    const user = await getUserWithIdentities(deps.db, vkUserSession.userId);
    expect(user?.providers.sort()).toEqual(["telegram", "vk"]);
  });

  test("rejects an assertion started in a different browser", async () => {
    const started = await startTelegramLogin(deps, null);
    const otherBrowser = await startTelegramLogin(deps, null);
    const params = widgetParams({ id: "42", first_name: "Маша", auth_date: nowSec });
    params.set("state", new URL(started.authUrl).searchParams.get("state")!);
    expect(await loginWithTelegramWidget(deps, params, null, otherBrowser.stateCookie)).toEqual({ ok: false, error: "telegram_state_mismatch" });
  });

  test("rejects a changed signed-in user during linking", async () => {
    const owner = await vkLogin("777", null);
    const started = await startTelegramLogin(deps, owner.token);
    const other = await vkLogin("888", null);
    const params = widgetParams({ id: "42", first_name: "Маша", auth_date: nowSec });
    params.set("state", new URL(started.authUrl).searchParams.get("state")!);
    expect(await loginWithTelegramWidget(deps, params, other.token, started.stateCookie)).toEqual({ ok: false, error: "telegram_state_mismatch" });
    expect((await getUserWithIdentities(deps.db, other.userId))?.providers).toEqual(["vk"]);
  });

  test("rejects expired intent even with a valid Telegram signature", async () => {
    const started = await startTelegramLogin(deps, null);
    const params = widgetParams({ id: "42", first_name: "Маша", auth_date: nowSec });
    params.set("state", new URL(started.authUrl).searchParams.get("state")!);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 601_000);
      expect(await loginWithTelegramWidget(deps, params, null, started.stateCookie)).toEqual({ ok: false, error: "telegram_state_mismatch" });
    } finally { vi.useRealTimers(); }
  });

  test("keeps a safe gift destination in the signed intent", async () => {
    expect(await widgetLogin({ id: "42", first_name: "Маша", auth_date: nowSec }, null, "/gifts/under-1000")).toMatchObject({ ok: true, returnTo: "/gifts/under-1000" });
    const unsafe = await widgetLogin({ id: "42", first_name: "Маша", auth_date: nowSec }, null, "//evil.example");
    expect(unsafe.ok && unsafe.returnTo).toBeUndefined();
  });

  test("rejects a forged state cookie", async () => {
    const params = widgetParams({ id: "42", first_name: "Маша", auth_date: nowSec });
    params.set("state", "forged");
    const forged = await signOAuthState({ state: "forged", codeVerifier: "telegram-widget", linkUserId: null }, "x".repeat(64));
    expect(await loginWithTelegramWidget(deps, params, null, forged)).toEqual({ ok: false, error: "telegram_state_mismatch" });
  });
});

describe("VK login", () => {
  test("keeps only a safe gift return destination", async () => {
    expect((await vkLogin("777", null, "/gifts/wedding")).returnTo).toBe("/gifts/wedding");
    expect((await vkLogin("777", null, "//evil.example")).returnTo).toBeUndefined();
  });

  test("rejects a session change before exchanging a VK code", async () => {
    const owner = await vkLogin("777", null);
    const started = await startVkLogin(deps, owner.token);
    vi.mocked(deps.fetchFn).mockClear();
    const state = new URL(started.redirectUrl).searchParams.get("state");
    expect(await finishVkLogin(deps, { code: "c", deviceId: "d", state, stateCookie: started.stateCookie, currentSessionToken: null })).toEqual({ ok: false, error: "vk_state_mismatch" });
    expect(deps.fetchFn).not.toHaveBeenCalled();
  });
  test("start builds an id.vk.ru authorize url with PKCE", async () => {
    const started = await startVkLogin(deps, null);
    const url = new URL(started.redirectUrl);
    expect(url.origin).toBe("https://id.vk.ru");
    expect(url.searchParams.get("redirect_uri")).toBe("https://wishly.ru/api/auth/vk/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  test("finish creates a user from VK profile", async () => {
    const { token } = await vkLogin("777", null);
    expect(await getCurrentUser(deps, token)).toMatchObject({ displayName: "Мария", avatarUrl: "https://vk.ru/a.jpg", providers: ["vk"] });
  });

  test("finish rejects a state mismatch without calling VK", async () => {
    const started = await startVkLogin(deps, null);
    const result = await finishVkLogin(deps, { code: "c", deviceId: "d", state: "evil", stateCookie: started.stateCookie, currentSessionToken: null });
    expect(result).toEqual({ ok: false, error: "vk_state_mismatch" });
    expect(deps.fetchFn).not.toHaveBeenCalled();
  });

  test("finish rejects missing parameters", async () => {
    const result = await finishVkLogin(deps, { code: null, deviceId: "d", state: "s", stateCookie: null, currentSessionToken: null });
    expect(result).toEqual({ ok: false, error: "vk_missing_params" });
  });

  test("linking an identity owned by a non-empty profile fails", async () => {
    const vkOwner = await vkLogin("777", null);
    await createWishlist(deps.db, vkOwner.userId, { title: "Список VK", occasion: "other", eventDate: null });
    const tgUser = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    if (!tgUser.ok) throw new Error("setup");
    const started = await startVkLogin(deps, tgUser.sessionToken);
    const state = new URL(started.redirectUrl).searchParams.get("state");
    vi.mocked(deps.fetchFn)
      .mockResolvedValueOnce(json({ access_token: "at" }))
      .mockResolvedValueOnce(json({ user: { user_id: "777", first_name: "Мария" } }));
    const result = await finishVkLogin(deps, { code: "c", deviceId: "d", state, stateCookie: started.stateCookie, currentSessionToken: tgUser.sessionToken });
    expect(result).toEqual({ ok: false, error: "link_IDENTITY_TAKEN" });
  });

  test("linking VK from an empty earlier profile merges it into the current user", async () => {
    await vkLogin("777", null);
    const tgUser = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    if (!tgUser.ok) throw new Error("setup");
    const linked = await vkLogin("777", tgUser.sessionToken);
    expect(linked.userId).toBe(tgUser.userId);
    expect((await getUserWithIdentities(deps.db, tgUser.userId))?.providers.sort()).toEqual(["telegram", "vk"]);
  });
});

describe("getCurrentUser", () => {
  test("returns null without a token, with a bad token, or for a deleted user", async () => {
    expect(await getCurrentUser(deps, null)).toBeNull();
    expect(await getCurrentUser(deps, "garbage")).toBeNull();
    const orphan = await signSession("00000000-0000-0000-0000-000000000000", env.SESSION_SECRET);
    expect(await getCurrentUser(deps, orphan)).toBeNull();
  });
});

import { createHash, createHmac } from "node:crypto";
import { signSession, verifySession } from "@wishlist/core";
import { getUserWithIdentities } from "@wishlist/db";
import { createTestDb } from "@wishlist/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type AuthDeps,
  finishVkLogin,
  getCurrentUser,
  loginWithTelegramInitData,
  loginWithTelegramWidget,
  startVkLogin,
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

async function vkLogin(vkId: string, currentSessionToken: string | null) {
  const started = await startVkLogin(deps, currentSessionToken);
  const state = new URL(started.redirectUrl).searchParams.get("state");
  vi.mocked(deps.fetchFn)
    .mockResolvedValueOnce(json({ access_token: "at" }))
    .mockResolvedValueOnce(json({ user: { user_id: vkId, first_name: "Мария", avatar: "https://vk.ru/a.jpg" } }));
  const result = await finishVkLogin(deps, { code: "c", deviceId: "d", state, stateCookie: started.stateCookie, currentSessionToken });
  if (!result.ok) throw new Error(result.error);
  return { token: result.sessionToken, userId: result.userId };
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
  test("logs in via widget and reuses the same user as the mini app", async () => {
    const viaMiniApp = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    const viaWidget = await loginWithTelegramWidget(deps, widgetParams({ id: "42", first_name: "Маша", auth_date: nowSec }), null);
    expect(viaWidget.ok && viaMiniApp.ok && viaWidget.userId === viaMiniApp.userId).toBe(true);
  });

  test("links telegram to the currently logged-in VK user", async () => {
    const vkUserSession = await vkLogin("777", null);
    const result = await loginWithTelegramWidget(deps, widgetParams({ id: "42", first_name: "Маша", auth_date: nowSec }), vkUserSession.token);
    expect(result).toMatchObject({ ok: true, userId: vkUserSession.userId });
    const user = await getUserWithIdentities(deps.db, vkUserSession.userId);
    expect(user?.providers.sort()).toEqual(["telegram", "vk"]);
  });
});

describe("VK login", () => {
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

  test("linking an identity owned by someone else fails", async () => {
    await vkLogin("777", null);
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
});

describe("getCurrentUser", () => {
  test("returns null without a token, with a bad token, or for a deleted user", async () => {
    expect(await getCurrentUser(deps, null)).toBeNull();
    expect(await getCurrentUser(deps, "garbage")).toBeNull();
    const orphan = await signSession("00000000-0000-0000-0000-000000000000", env.SESSION_SECRET);
    expect(await getCurrentUser(deps, orphan)).toBeNull();
  });
});

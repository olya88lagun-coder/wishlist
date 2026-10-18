import { createHash, createHmac } from "node:crypto";
import { signSession } from "@wishlist/core";
import { getUserWithIdentities, upsertUserFromIdentity } from "@wishlist/db";
import { createTestDb } from "@wishlist/db/testing";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";
import type { AuthDeps } from "./auth-service";
import { SESSION_COOKIE, TELEGRAM_STATE_COOKIE } from "./http";

let deps: AuthDeps;
vi.mock("@/server/deps", () => ({ authDeps: () => deps }));
import { POST as start } from "@/app/api/auth/telegram/start/route";
import { GET as callback } from "@/app/api/auth/telegram/widget/route";

beforeEach(async () => {
  deps = { db: await createTestDb(), env: { APP_URL: "https://wishly.ru", DATABASE_URL: "unused", SESSION_SECRET: "s".repeat(64), TELEGRAM_BOT_TOKEN: "123456:test", TELEGRAM_BOT_USERNAME: "test_bot", VK_CLIENT_ID: "555" }, now: () => new Date(), fetchFn: vi.fn() };
});

function begin(origin = "https://wishly.ru", cookie = "") {
  return start(new NextRequest("https://wishly.ru/api/auth/telegram/start", { method: "POST", headers: { origin, cookie, "content-type": "application/json" }, body: JSON.stringify({ returnTo: "/gifts/under-1000" }) }));
}
function signedCallback(authUrl: string) {
  const fields = { id: "42", first_name: "Маша", auth_date: String(Math.floor(deps.now().getTime() / 1000)) };
  const secret = createHash("sha256").update(deps.env.TELEGRAM_BOT_TOKEN).digest();
  const data = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const url = new URL(authUrl);
  for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
  url.searchParams.set("hash", createHmac("sha256", secret).update(data).digest("hex"));
  return url.toString();
}

test("rejects a cross-site start without issuing an intent cookie", async () => {
  const response = await begin("https://evil.example");
  expect(response.status).toBe(403);
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("callback consumes browser intent, links the current VK profile and returns to the gift", async () => {
  const owner = await upsertUserFromIdentity(deps.db, { provider: "vk", providerUserId: "777", displayName: "Мария", avatarUrl: null });
  const session = await signSession(owner.id, deps.env.SESSION_SECRET);
  const started = await begin(undefined, `${SESSION_COOKIE}=${session}`);
  const intent = started.cookies.get(TELEGRAM_STATE_COOKIE)!;
  expect(started.headers.get("set-cookie")).toContain("HttpOnly");
  expect(started.headers.get("set-cookie")).toContain("SameSite=lax");
  const url = signedCallback((await started.json()).authUrl);
  const response = await callback(new NextRequest(url, { headers: { cookie: `${SESSION_COOKIE}=${session}; ${TELEGRAM_STATE_COOKIE}=${intent.value}` } }));
  expect(response.headers.get("location")).toBe("https://wishly.ru/gifts/under-1000");
  expect(response.cookies.get(TELEGRAM_STATE_COOKIE)?.value).toBe("");
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(response.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
  expect((await getUserWithIdentities(deps.db, owner.id))?.providers.sort()).toEqual(["telegram", "vk"]);

  const replay = await callback(new NextRequest(url, { headers: { cookie: `${SESSION_COOKIE}=${session}` } }));
  expect(replay.headers.get("location")).toContain("error=telegram_state_mismatch");
  expect(replay.cookies.get(SESSION_COOKIE)).toBeUndefined();
});

test("a failed callback clears the intent without replacing the session", async () => {
  const started = await begin();
  const intent = started.cookies.get(TELEGRAM_STATE_COOKIE)!;
  const url = new URL((await started.json()).authUrl);
  url.searchParams.set("hash", "bad");
  const response = await callback(new NextRequest(url, { headers: { cookie: `${TELEGRAM_STATE_COOKIE}=${intent.value}` } }));
  expect(response.headers.get("location")).toContain("error=telegram_BAD_HASH");
  expect(response.cookies.get(TELEGRAM_STATE_COOKIE)?.value).toBe("");
  expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
});

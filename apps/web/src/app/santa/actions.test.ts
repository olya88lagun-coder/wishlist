import { verifySessionClaims } from "@wishlist/core";
import { createSantaGame, getSantaGameView, getUserWithIdentities, upsertUserFromIdentity, type Database } from "@wishlist/db";
import { createTestDb } from "@wishlist/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";

const SECRET = "s".repeat(64);
let db: Database;
let currentUserId: string | null;
let jar: Map<string, string>;
let clientId: string;

vi.mock("@/server/db", () => ({ getDb: () => db }));
vi.mock("@/server/env", () => ({ getEnv: () => ({ APP_URL: "https://my-wish-list.online", SESSION_SECRET: SECRET }) }));
vi.mock("@/server/analytics-completion", () => ({ recordCompletion: vi.fn() }));
vi.mock("@/server/queue", () => ({ enqueueNotify: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: (name: string, value: string) => jar.set(name, value), get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined) }) }));
vi.mock("@/server/viewer", () => ({
  readViewer: async () => ({ viewer: { userId: currentUserId, guestToken: null }, user: currentUserId ? await getUserWithIdentities(db, currentUserId) : null }),
  requireUser: async () => {
    if (!currentUserId) throw new Error("redirect:/login");
    return getUserWithIdentities(db, currentUserId);
  },
  clientKey: async () => clientId,
}));

import { recordCompletion } from "@/server/analytics-completion";
import { SESSION_COOKIE } from "@/server/http";
import { drawSantaGameAction, joinSantaGameAction } from "./actions";
import { initialSantaJoinState } from "./join-state";

let organizer: string;
let joinCode: string;
let gameId: string;

function nameForm(name: string) {
  const form = new FormData();
  form.set("name", name);
  return form;
}

beforeEach(async () => {
  vi.clearAllMocks();
  clientId = crypto.randomUUID();
  jar = new Map();
  db = await createTestDb();
  organizer = (await upsertUserFromIdentity(db, { provider: "telegram", providerUserId: "1", displayName: "Оля", avatarUrl: null })).id;
  const game = await createSantaGame(db, organizer, { title: "Отдел", budgetText: "до 1 500 ₽", exchangeDate: "2026-12-25", organizerName: "Оля" });
  if (!game.ok) throw new Error("setup");
  ({ joinCode, gameId } = game);
  currentUserId = null;
});

describe("joinSantaGameAction", () => {
  test("join without session creates anonymous user and sets session cookie", async () => {
    const state = await joinSantaGameAction(joinCode, initialSantaJoinState, nameForm("Петя"));
    expect(state.status).toBe("success");
    expect(state.personalLink).toMatch(/^https:\/\/my-wish-list\.online\/santa\/me\/[A-Za-z0-9_-]{43}$/);
    const claims = await verifySessionClaims(jar.get(SESSION_COOKIE)!, SECRET);
    const user = await getUserWithIdentities(db, claims!.userId);
    expect(user).toMatchObject({ displayName: "Петя", isAnonymous: true });
    expect(await getSantaGameView(db, gameId, claims!.userId)).not.toBeNull();
    expect(recordCompletion).toHaveBeenCalledWith({ event: "santa_joined", params: { signed_in: false } });
  });

  test("a rejected join does not leave an anonymous user behind", async () => {
    const state = await joinSantaGameAction("unknown-code", initialSantaJoinState, nameForm("Петя"));
    expect(state).toMatchObject({ status: "error" });
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  test("signed-in user joins with own account and goes to the game", async () => {
    currentUserId = (await upsertUserFromIdentity(db, { provider: "vk", providerUserId: "9", displayName: "Аня", avatarUrl: null })).id;
    await expect(joinSantaGameAction(joinCode, initialSantaJoinState, nameForm("Аня"))).rejects.toThrow(`redirect:/santa/${gameId}`);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  test("join is rate limited per client key", async () => {
    for (let i = 0; i < 10; i++) await joinSantaGameAction("unknown-code", initialSantaJoinState, nameForm("Петя"));
    const state = await joinSantaGameAction(joinCode, initialSantaJoinState, nameForm("Петя"));
    expect(state.message).toMatch(/Подождите минуту/);
  });
});

describe("drawSantaGameAction", () => {
  test("draw by non-organizer is refused", async () => {
    currentUserId = (await upsertUserFromIdentity(db, { provider: "vk", providerUserId: "9", displayName: "Аня", avatarUrl: null })).id;
    expect(await drawSantaGameAction(gameId)).toEqual({ ok: false, message: expect.any(String) });
  });
});

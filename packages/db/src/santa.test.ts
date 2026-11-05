import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { addItem } from "./items";
import { SANTA_MAX_GAMES_PER_ORGANIZER, SANTA_MAX_PARTICIPANTS } from "./limits";
import {
  assignSantaRecipients,
  createAnonymousUser,
  createSantaGame,
  drawSantaGame,
  getSantaGameView,
  issueRecoveryToken,
  joinSantaGame,
  listSantaGamesForUser,
  redeemSantaToken,
  removeSantaParticipant,
} from "./santa";
import { authIdentities, santaParticipants } from "./schema";
import { createTestDb } from "./testing";
import type { Database } from "./types";

let db: Database;
let organizer: string;

async function identifiedUser(name: string, providerUserId: string): Promise<string> {
  const { userId } = await createAnonymousUser(db, name);
  await db.insert(authIdentities).values({ userId, provider: "telegram", providerUserId });
  return userId;
}

async function newGame(): Promise<{ gameId: string; joinCode: string }> {
  const created = await createSantaGame(db, organizer, { title: "Отдел", budgetText: "до 1 500 ₽", exchangeDate: "2026-12-25", organizerName: "Оля" });
  if (!created.ok) throw new Error(created.reason);
  return created;
}

async function joinAnonymous(joinCode: string, name: string) {
  const { userId } = await createAnonymousUser(db, name);
  const joined = await joinSantaGame(db, joinCode, userId, name);
  if (!joined.ok) throw new Error(joined.reason);
  return { userId, ...joined };
}

function seeded(seed: number) {
  let state = seed;
  return (max: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % max;
  };
}

beforeEach(async () => {
  db = await createTestDb();
  organizer = await identifiedUser("Оля", "100");
});

describe("createSantaGame", () => {
  test("creates the game with the organizer as a participant with a new-year list", async () => {
    const { gameId } = await newGame();
    const view = await getSantaGameView(db, gameId, organizer);
    expect(view?.isOrganizer).toBe(true);
    expect(view?.participants.map((p) => p.displayName)).toEqual(["Оля"]);
    expect(view?.me.wishlistSlug).toBeTruthy();
  });

  test("refuses an anonymous organizer", async () => {
    const { userId } = await createAnonymousUser(db, "Аноним");
    const created = await createSantaGame(db, userId, { title: "Игра", budgetText: "", exchangeDate: "2026-12-25", organizerName: "Аноним" });
    expect(created).toEqual({ ok: false, reason: "ANONYMOUS_ORGANIZER" });
  });

  test("21st game returns LIMIT", async () => {
    for (let i = 0; i < SANTA_MAX_GAMES_PER_ORGANIZER; i++) await newGame();
    const created = await createSantaGame(db, organizer, { title: "Ещё", budgetText: "", exchangeDate: "2026-12-25", organizerName: "Оля" });
    expect(created).toEqual({ ok: false, reason: "LIMIT" });
  });
});

describe("joinSantaGame", () => {
  test("anonymous join gets a personal token, a repeat join is idempotent", async () => {
    const { joinCode } = await newGame();
    const first = await joinAnonymous(joinCode, "Петя");
    expect(first.personalToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.alreadyJoined).toBe(false);
    const again = await joinSantaGame(db, joinCode, first.userId, "Петя");
    expect(again).toMatchObject({ ok: true, participantId: first.participantId, alreadyJoined: true, personalToken: null });
  });

  test("organizer opening own join link is alreadyJoined", async () => {
    const { joinCode } = await newGame();
    expect(await joinSantaGame(db, joinCode, organizer, "Оля")).toMatchObject({ ok: true, alreadyJoined: true });
  });

  test("31st participant returns FULL", async () => {
    const { joinCode } = await newGame();
    for (let i = 1; i < SANTA_MAX_PARTICIPANTS; i++) await joinAnonymous(joinCode, `Гость ${i}`);
    const { userId } = await createAnonymousUser(db, "Лишний");
    expect(await joinSantaGame(db, joinCode, userId, "Лишний")).toEqual({ ok: false, reason: "FULL" });
  });

  test("join after draw returns CLOSED", async () => {
    const { gameId, joinCode } = await newGame();
    await joinAnonymous(joinCode, "Петя");
    await joinAnonymous(joinCode, "Аня");
    expect(await drawSantaGame(db, gameId, organizer)).toEqual({ ok: true });
    const { userId } = await createAnonymousUser(db, "Поздний");
    expect(await joinSantaGame(db, joinCode, userId, "Поздний")).toEqual({ ok: false, reason: "CLOSED" });
  });

  test("rejects an empty or too long name and an unknown code", async () => {
    const { joinCode } = await newGame();
    const { userId } = await createAnonymousUser(db, "x");
    expect(await joinSantaGame(db, joinCode, userId, "  ")).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(await joinSantaGame(db, joinCode, userId, "я".repeat(41))).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(await joinSantaGame(db, "nope", userId, "Петя")).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  test("concurrent join and draw leave nobody without a pair", async () => {
    const { gameId, joinCode } = await newGame();
    await joinAnonymous(joinCode, "Петя");
    await joinAnonymous(joinCode, "Аня");
    const { userId } = await createAnonymousUser(db, "Вася");
    const [, joined] = await Promise.all([drawSantaGame(db, gameId, organizer), joinSantaGame(db, joinCode, userId, "Вася")]);
    const rows = await db.select().from(santaParticipants).where(eq(santaParticipants.gameId, gameId));
    if (joined.ok) expect(rows).toHaveLength(4);
    else expect(joined.reason).toBe("CLOSED");
    for (const row of rows) expect(row.recipientParticipantId).not.toBeNull();
  });
});

describe("drawSantaGame", () => {
  test.each([3, 4, 30])("assignment gives everyone exactly one recipient and nobody themselves (%i players)", (size) => {
    const ids = Array.from({ length: size }, (_, i) => `p${i}`);
    for (let seed = 1; seed <= 50; seed++) {
      const pairs = assignSantaRecipients(ids, seeded(seed));
      expect([...pairs.keys()].sort()).toEqual([...ids].sort());
      expect(new Set(pairs.values()).size).toBe(size);
      for (const [giver, recipient] of pairs) expect(recipient).not.toBe(giver);
    }
  });

  test.each([3, 30])("draw stores a recipient for every participant (%i players)", async (size) => {
    const { gameId, joinCode } = await newGame();
    for (let i = 1; i < size; i++) await joinAnonymous(joinCode, `Гость ${i}`);
    expect(await drawSantaGame(db, gameId, organizer, seeded(7))).toEqual({ ok: true });
    const rows = await db.select().from(santaParticipants).where(eq(santaParticipants.gameId, gameId));
    expect(new Set(rows.map((r) => r.recipientParticipantId)).size).toBe(size);
    for (const row of rows) expect(row.recipientParticipantId).not.toBe(row.id);
  }, 60_000);

  test("second draw is rejected and does not reshuffle", async () => {
    const { gameId, joinCode } = await newGame();
    await joinAnonymous(joinCode, "Петя");
    await joinAnonymous(joinCode, "Аня");
    await drawSantaGame(db, gameId, organizer);
    const before = await db.select().from(santaParticipants).where(eq(santaParticipants.gameId, gameId));
    expect(await drawSantaGame(db, gameId, organizer)).toEqual({ ok: false, reason: "ALREADY_DRAWN" });
    const after = await db.select().from(santaParticipants).where(eq(santaParticipants.gameId, gameId));
    expect(after.map((r) => [r.id, r.recipientParticipantId]).sort()).toEqual(before.map((r) => [r.id, r.recipientParticipantId]).sort());
  });

  test("refuses fewer than 3 players and a non-organizer", async () => {
    const { gameId, joinCode } = await newGame();
    const petya = await joinAnonymous(joinCode, "Петя");
    expect(await drawSantaGame(db, gameId, organizer)).toEqual({ ok: false, reason: "TOO_FEW" });
    await joinAnonymous(joinCode, "Аня");
    expect(await drawSantaGame(db, gameId, petya.userId)).toEqual({ ok: false, reason: "NOT_ORGANIZER" });
  });
});

describe("getSantaGameView", () => {
  test("organizer view has no recipients of others; participant view after draw has recipient name and slug", async () => {
    const { gameId, joinCode } = await newGame();
    const petya = await joinAnonymous(joinCode, "Петя");
    await joinAnonymous(joinCode, "Аня");
    const petyaView = await getSantaGameView(db, gameId, petya.userId);
    await addItem(db, petya.userId, petyaView!.me.wishlistId!, { title: "Носки", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    await drawSantaGame(db, gameId, organizer);

    const organizerView = await getSantaGameView(db, gameId, organizer);
    expect(organizerView?.game.joinCode).toBe(joinCode);
    expect(organizerView?.participants.find((p) => p.displayName === "Петя")?.itemCount).toBe(1);
    expect(JSON.stringify(organizerView?.participants)).not.toMatch(/recipient/i);
    expect(organizerView?.recipient?.displayName).toMatch(/Петя|Аня/);

    const view = await getSantaGameView(db, gameId, petya.userId);
    expect(view?.game.joinCode).toBeNull();
    expect(["Оля", "Аня"]).toContain(view?.recipient?.displayName);
    expect(view?.recipient?.wishlistSlug).toBeTruthy();
  });

  test("returns null for a non-participant and lists games for a participant", async () => {
    const { gameId } = await newGame();
    const { userId } = await createAnonymousUser(db, "Чужой");
    expect(await getSantaGameView(db, gameId, userId)).toBeNull();
    expect(await listSantaGamesForUser(db, organizer)).toEqual([{ id: gameId, title: "Отдел", status: "open" }]);
  });
});

describe("tokens", () => {
  test("personal token restores the anonymous user and stops working after identity is linked", async () => {
    const { gameId, joinCode } = await newGame();
    const petya = await joinAnonymous(joinCode, "Петя");
    expect(await redeemSantaToken(db, petya.personalToken!)).toEqual({ userId: petya.userId, gameId });
    expect(await redeemSantaToken(db, petya.personalToken!)).toEqual({ userId: petya.userId, gameId });
    await db.insert(authIdentities).values({ userId: petya.userId, provider: "telegram", providerUserId: "200" });
    expect(await redeemSantaToken(db, petya.personalToken!)).toBeNull();
  });

  test("recovery token works once, dies on draw, and is refused for users with an identity", async () => {
    const { gameId, joinCode } = await newGame();
    const petya = await joinAnonymous(joinCode, "Петя");
    const anya = await joinAnonymous(joinCode, "Аня");
    const signedIn = await identifiedUser("Вошедший", "300");
    const joinedSignedIn = await joinSantaGame(db, joinCode, signedIn, "Вошедший");

    expect(await issueRecoveryToken(db, gameId, petya.userId, anya.participantId)).toBeNull();
    if (!joinedSignedIn.ok) throw new Error("setup");
    expect(await issueRecoveryToken(db, gameId, organizer, joinedSignedIn.participantId)).toBeNull();

    const once = await issueRecoveryToken(db, gameId, organizer, petya.participantId);
    expect(await redeemSantaToken(db, once!)).toEqual({ userId: petya.userId, gameId });
    expect(await redeemSantaToken(db, once!)).toBeNull();

    const beforeDraw = await issueRecoveryToken(db, gameId, organizer, anya.participantId);
    await drawSantaGame(db, gameId, organizer);
    expect(await redeemSantaToken(db, beforeDraw!)).toBeNull();
    expect(await issueRecoveryToken(db, gameId, organizer, anya.participantId)).toBeNull();
  });
});

describe("removeSantaParticipant", () => {
  test("organizer removes a participant before the draw but not himself and not after", async () => {
    const { gameId, joinCode } = await newGame();
    const petya = await joinAnonymous(joinCode, "Петя");
    const self = await getSantaGameView(db, gameId, organizer);
    expect(await removeSantaParticipant(db, gameId, organizer, self!.me.participantId)).toBe(false);
    expect(await removeSantaParticipant(db, gameId, petya.userId, petya.participantId)).toBe(false);
    expect(await removeSantaParticipant(db, gameId, organizer, petya.participantId)).toBe(true);
    expect(await getSantaGameView(db, gameId, petya.userId)).toBeNull();
  });
});

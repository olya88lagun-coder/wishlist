import type { NotifyJob } from "@wishlist/core";
import { addItem, createTestDb, createUserFixture, createWishlist, type Database, getBotItemCard, reservations } from "@wishlist/db/testing";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { cancelReservationCallback } from "../notify";
import { type CallbackDeps, handleCallback } from "./callbacks";

let db: Database;
let owner: string;
let stranger: string;
let oldList: string;
let newList: string;
let itemId: string;
let notices: NotifyJob[];

function deps(): CallbackDeps {
  return { db, appUrl: "https://my-wish-list.online", imagesPublicBaseUrl: null, enqueueNotify: async (job) => void notices.push(job) };
}

beforeEach(async () => {
  db = await createTestDb();
  notices = [];
  owner = await createUserFixture(db, "Маша");
  stranger = await createUserFixture(db, "Оля");
  const a = await createWishlist(db, owner, { title: "Новый год", occasion: "new_year", eventDate: null });
  const b = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!a.ok || !b.ok) throw new Error("setup");
  oldList = a.wishlist.id;
  newList = b.wishlist.id;
  const added = await addItem(db, owner, newList, { title: "Свеча", sourceUrl: null, priceKopecks: 99000, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

describe("moving between lists", () => {
  test("shows the owner's lists newest first, moves on choice and returns the card", async () => {
    const choice = await handleCallback(deps(), owner, `mv:${itemId}`);
    expect(choice).toEqual({
      kind: "markup",
      markup: {
        inline_keyboard: [
          [{ text: "ДР", callback_data: `to:${itemId}:0` }],
          [{ text: "Новый год", callback_data: `to:${itemId}:1` }],
          [{ text: "← Назад", callback_data: `bk:${itemId}` }],
        ],
      },
    });
    const moved = await handleCallback(deps(), owner, `to:${itemId}:1`);
    expect(moved).toMatchObject({ kind: "edit", text: expect.stringContaining("В списке «Новый год»") });
    expect((await getBotItemCard(db, itemId))?.wishlistId).toBe(oldList);
  });

  test("back restores the card buttons", async () => {
    const back = await handleCallback(deps(), owner, `bk:${itemId}`);
    expect(back.kind).toBe("markup");
    if (back.kind === "markup") expect(back.markup.inline_keyboard.flat().map((b) => b.text)).toEqual(["В список ▾", "Удалить", "Изменить"]);
  });

  test("strangers and stale buttons get a toast and change nothing", async () => {
    expect(await handleCallback(deps(), stranger, `mv:${itemId}`)).toEqual({ kind: "toast", text: "Этот подарок уже недоступен" });
    expect(await handleCallback(deps(), stranger, `to:${itemId}:1`)).toEqual({ kind: "toast", text: "Этот подарок уже недоступен" });
    expect(await handleCallback(deps(), owner, `to:${itemId}:9`)).toEqual({ kind: "toast", text: "Список не найден — откройте выбор ещё раз" });
    expect(await handleCallback(deps(), owner, "whatever")).toEqual({ kind: "toast", text: "Кнопка устарела" });
    expect((await getBotItemCard(db, itemId))?.wishlistId).toBe(newList);
  });
});

test("delete removes the owner's item, notifies a possible guest and leaves a short note", async () => {
  expect(await handleCallback(deps(), stranger, `del:${itemId}`)).toEqual({ kind: "toast", text: "Этот подарок уже недоступен" });
  const result = await handleCallback(deps(), owner, `del:${itemId}`);
  expect(result).toEqual({ kind: "edit", text: "Удалил «Свеча» из списка «ДР».", extra: { reply_markup: { inline_keyboard: [] } } });
  expect((await getBotItemCard(db, itemId))?.deleted).toBe(true);
  expect(notices).toEqual([{ kind: "item_deleted", itemId }]);
});

test("guest cancels own reservation from the confirmation message", async () => {
  const [row] = await db.insert(reservations).values({ itemId, guestUserId: stranger, guestName: "Оля", cancelToken: "c1" }).returning({ id: reservations.id });
  expect(await handleCallback(deps(), owner, cancelReservationCallback(row!.id))).toEqual({ kind: "toast", text: "Бронь уже снята" });
  expect(await handleCallback(deps(), stranger, cancelReservationCallback(row!.id))).toEqual({
    kind: "edit",
    text: "Бронь снята — подарок снова свободен.",
    extra: { reply_markup: { inline_keyboard: [] } },
  });
  const [after] = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.id, row!.id));
  expect(after?.status).toBe("cancelled");
});

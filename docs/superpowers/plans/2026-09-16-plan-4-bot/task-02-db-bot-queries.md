# Task 2: Запросы бота и подписанная ссылка «Напомнить в Telegram»

**Files:**
- Create: `packages/core/src/auth/reminder-link.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/auth/reminder-link.test.ts`
- Modify: `packages/db/src/items.ts` (экспорт `ownedItemId`), `packages/db/src/index.ts`
- Create: `packages/db/src/bot.ts`
- Test: `packages/db/src/bot.test.ts`

**Interfaces:**
- Consumes: `getOwnedWishlist`, `MAX_ITEMS_PER_WISHLIST`, `isUuid`, схема (план 2); `detectStore` из core.
- Produces:
  ```ts
  // @wishlist/core
  function signReminderPayload(reservationId: string, secret: string): string;       // "r" + 22 + 16 символов, всего 39
  function verifyReminderPayload(payload: string, secret: string): string | null;    // id брони или null
  // @wishlist/db
  function ownedItemId(db: Database, ownerId: string, itemId: string): Promise<string | null>; // уже был в items.ts, теперь экспортируется
  function findUserIdByTelegram(db: Database, telegramId: number): Promise<string | null>;
  type AttachResult = "attached" | "already_yours" | "taken" | "not_found";
  function attachReservationToUser(db: Database, reservationId: string, userId: string): Promise<AttachResult>;
  function cancelReservationForUser(db: Database, reservationId: string, userId: string): Promise<boolean>;
  type BotItemCard = { id: string; ownerId: string; wishlistId: string; wishlistTitle: string; title: string; sourceUrl: string | null; priceKopecks: number | null; imageKey: string | null; parseStatus: ItemParseStatus; deleted: boolean };
  function getBotItemCard(db: Database, itemId: string): Promise<BotItemCard | null>;
  type MoveResult = "moved" | "not_found" | "limit_reached";
  function moveItem(db: Database, ownerId: string, itemId: string, toWishlistId: string): Promise<MoveResult>;
  ```

Почему подписанная ссылка, а не `cancelToken`: тест приватности плана 2 требует, чтобы токен отмены никогда не попадал в ответ страницы. Ссылка `t.me/<бот>?start=r…` содержит id брони и HMAC от `SESSION_SECRET` — её может выпустить только сервер, и она не даёт права отмены на сайте.

- [ ] **Step 1: Тест подписи (падает)**

`packages/core/src/auth/reminder-link.test.ts`:
```ts
import { expect, test } from "vitest";
import { signReminderPayload, verifyReminderPayload } from "./reminder-link";

const SECRET = "s".repeat(32);
const ID = "3c5e5e81-358d-4c3d-b4ed-100bac8fea49";

test("round-trips a reservation id through a Telegram start parameter", () => {
  const payload = signReminderPayload(ID, SECRET);
  expect(payload).toMatch(/^r[A-Za-z0-9_-]{38}$/);
  expect(payload.length).toBeLessThanOrEqual(64);
  expect(verifyReminderPayload(payload, SECRET)).toBe(ID);
});

test("rejects forged, truncated and foreign payloads", () => {
  const payload = signReminderPayload(ID, SECRET);
  const forged = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;
  expect(verifyReminderPayload(forged, SECRET)).toBeNull();
  expect(verifyReminderPayload(payload.slice(0, 20), SECRET)).toBeNull();
  expect(verifyReminderPayload(payload, "x".repeat(32))).toBeNull();
  expect(verifyReminderPayload("inline", SECRET)).toBeNull();
});
```

Run: `pnpm vitest run packages/core/src/auth/reminder-link.test.ts`
Expected: FAIL — `Failed to resolve import "./reminder-link"`.

- [ ] **Step 2: Подпись**

`packages/core/src/auth/reminder-link.ts`:
```ts
import { createHmac, timingSafeEqual } from "node:crypto";

// Параметр /start в Telegram — до 64 символов [A-Za-z0-9_-]: "r" + uuid в base64url (22) + подпись (16)
const PREFIX = "r";
const ID_LENGTH = 22;
const SIGNATURE_BYTES = 12;
const PAYLOAD_LENGTH = PREFIX.length + ID_LENGTH + 16;

function signature(idPart: string, secret: string): Buffer {
  const key = createHmac("sha256", secret).update("reminder-link").digest();
  return createHmac("sha256", key).update(idPart).digest().subarray(0, SIGNATURE_BYTES);
}

export function signReminderPayload(reservationId: string, secret: string): string {
  const idPart = Buffer.from(reservationId.replace(/-/g, ""), "hex").toString("base64url");
  return `${PREFIX}${idPart}${signature(idPart, secret).toString("base64url")}`;
}

export function verifyReminderPayload(payload: string, secret: string): string | null {
  if (payload.length !== PAYLOAD_LENGTH || !payload.startsWith(PREFIX)) return null;
  const idPart = payload.slice(PREFIX.length, PREFIX.length + ID_LENGTH);
  const actual = Buffer.from(payload.slice(PREFIX.length + ID_LENGTH), "base64url");
  const expected = signature(idPart, secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const hex = Buffer.from(idPart, "base64url").toString("hex");
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

В `packages/core/src/index.ts` добавить:
```ts
export * from "./auth/reminder-link";
```

Run: `pnpm vitest run packages/core`
Expected: PASS.

- [ ] **Step 3: Тест запросов бота (падает)**

В `packages/db/src/items.ts` заменить `async function ownedItemId(` на `export async function ownedItemId(`.

`packages/db/src/bot.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import {
  attachReservationToUser,
  cancelReservationForUser,
  findUserIdByTelegram,
  getBotItemCard,
  moveItem,
} from "./bot";
import { addItem, deleteItem } from "./items";
import { MAX_ITEMS_PER_WISHLIST } from "./limits";
import { authIdentities, items, reservations } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

const WB = "https://www.wildberries.ru/catalog/173937886/detail.aspx";

let db: Database;
let owner: string;
let stranger: string;
let firstList: string;
let secondList: string;
let itemId: string;

async function reservationFor(guestUserId: string | null) {
  const [row] = await db
    .insert(reservations)
    .values({ itemId, guestUserId, guestToken: guestUserId ? null : "tok", guestName: "Оля", cancelToken: `c-${Math.random()}` })
    .returning({ id: reservations.id });
  return row!.id;
}

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  stranger = await createUserFixture(db, "Оля");
  const a = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  const b = await createWishlist(db, owner, { title: "Новый год", occasion: "new_year", eventDate: null });
  if (!a.ok || !b.ok) throw new Error("setup");
  firstList = a.wishlist.id;
  secondList = b.wishlist.id;
  const added = await addItem(db, owner, firstList, { title: "", sourceUrl: WB, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

test("findUserIdByTelegram maps a Telegram id to the user", async () => {
  await db.insert(authIdentities).values({ userId: owner, provider: "telegram", providerUserId: "777" });
  expect(await findUserIdByTelegram(db, 777)).toBe(owner);
  expect(await findUserIdByTelegram(db, 778)).toBeNull();
});

describe("getBotItemCard", () => {
  test("returns what the card message needs, including the owner and deletion", async () => {
    expect(await getBotItemCard(db, itemId)).toEqual({
      id: itemId,
      ownerId: owner,
      wishlistId: firstList,
      wishlistTitle: "ДР",
      title: "",
      sourceUrl: WB,
      priceKopecks: null,
      imageKey: null,
      parseStatus: "pending",
      deleted: false,
    });
    await deleteItem(db, owner, itemId);
    expect((await getBotItemCard(db, itemId))?.deleted).toBe(true);
    expect(await getBotItemCard(db, "nope")).toBeNull();
  });
});

describe("moveItem", () => {
  test("moves only the owner's item into the owner's list", async () => {
    expect(await moveItem(db, stranger, itemId, secondList)).toBe("not_found");
    const foreign = await createWishlist(db, stranger, { title: "Чужой", occasion: "other", eventDate: null });
    if (!foreign.ok) throw new Error("setup");
    expect(await moveItem(db, owner, itemId, foreign.wishlist.id)).toBe("not_found");
    expect(await moveItem(db, owner, itemId, secondList)).toBe("moved");
    expect((await getBotItemCard(db, itemId))?.wishlistId).toBe(secondList);
    expect(await moveItem(db, owner, itemId, secondList)).toBe("moved");
  });

  test("respects the item limit of the target list", async () => {
    const filler = Array.from({ length: MAX_ITEMS_PER_WISHLIST }, (_, i) => ({ wishlistId: secondList, title: `#${i}`, parseStatus: "ok" as const }));
    await db.insert(items).values(filler);
    expect(await moveItem(db, owner, itemId, secondList)).toBe("limit_reached");
  });
});

describe("reservations from the bot", () => {
  test("attaches a site reservation to the Telegram user once", async () => {
    const reservationId = await reservationFor(null);
    expect(await attachReservationToUser(db, reservationId, stranger)).toBe("attached");
    expect(await attachReservationToUser(db, reservationId, stranger)).toBe("already_yours");
    expect(await attachReservationToUser(db, reservationId, owner)).toBe("taken");
    const [row] = await db.select({ guestUserId: reservations.guestUserId }).from(reservations).where(eq(reservations.id, reservationId));
    expect(row?.guestUserId).toBe(stranger);
  });

  test("does not attach cancelled or unknown reservations", async () => {
    const reservationId = await reservationFor(null);
    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, reservationId));
    expect(await attachReservationToUser(db, reservationId, stranger)).toBe("not_found");
    expect(await attachReservationToUser(db, "bad-id", stranger)).toBe("not_found");
  });

  test("cancels only the user's own active reservation", async () => {
    const reservationId = await reservationFor(stranger);
    expect(await cancelReservationForUser(db, reservationId, owner)).toBe(false);
    expect(await cancelReservationForUser(db, reservationId, stranger)).toBe(true);
    expect(await cancelReservationForUser(db, reservationId, stranger)).toBe(false);
  });
});
```

Run: `pnpm vitest run packages/db/src/bot.test.ts`
Expected: FAIL — `Failed to resolve import "./bot"`.

- [ ] **Step 4: Реализация**

`packages/db/src/bot.ts`:
```ts
import { and, eq, isNull } from "drizzle-orm";
import { isUuid } from "./errors";
import { ownedItemId } from "./items";
import { MAX_ITEMS_PER_WISHLIST } from "./limits";
import { authIdentities, type ItemParseStatus, items, reservations, wishlists } from "./schema";
import type { Database } from "./types";
import { getOwnedWishlist } from "./wishlists";

export async function findUserIdByTelegram(db: Database, telegramId: number): Promise<string | null> {
  const [row] = await db
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, "telegram"), eq(authIdentities.providerUserId, String(telegramId))))
    .limit(1);
  return row?.userId ?? null;
}

export type AttachResult = "attached" | "already_yours" | "taken" | "not_found";

// Гость с сайта нажал «Напомнить в Telegram»: бронь получает пользователя, и напоминания начинают ходить
export async function attachReservationToUser(db: Database, reservationId: string, userId: string): Promise<AttachResult> {
  if (!isUuid(reservationId)) return "not_found";
  const [row] = await db
    .select({ guestUserId: reservations.guestUserId })
    .from(reservations)
    .where(and(eq(reservations.id, reservationId), eq(reservations.status, "active")));
  if (!row) return "not_found";
  if (row.guestUserId === userId) return "already_yours";
  if (row.guestUserId !== null) return "taken";
  const updated = await db
    .update(reservations)
    .set({ guestUserId: userId })
    .where(and(eq(reservations.id, reservationId), isNull(reservations.guestUserId)))
    .returning({ id: reservations.id });
  return updated.length > 0 ? "attached" : "taken";
}

export async function cancelReservationForUser(db: Database, reservationId: string, userId: string): Promise<boolean> {
  if (!isUuid(reservationId)) return false;
  const cancelled = await db
    .update(reservations)
    .set({ status: "cancelled" })
    .where(and(eq(reservations.id, reservationId), eq(reservations.guestUserId, userId), eq(reservations.status, "active")))
    .returning({ id: reservations.id });
  return cancelled.length > 0;
}

export type BotItemCard = {
  id: string;
  ownerId: string;
  wishlistId: string;
  wishlistTitle: string;
  title: string;
  sourceUrl: string | null;
  priceKopecks: number | null;
  imageKey: string | null;
  parseStatus: ItemParseStatus;
  deleted: boolean;
};

export async function getBotItemCard(db: Database, itemId: string): Promise<BotItemCard | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({
      id: items.id,
      ownerId: wishlists.ownerId,
      wishlistId: wishlists.id,
      wishlistTitle: wishlists.title,
      title: items.title,
      sourceUrl: items.sourceUrl,
      priceKopecks: items.priceKopecks,
      imageKey: items.imageKey,
      parseStatus: items.parseStatus,
      deletedAt: items.deletedAt,
    })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .where(eq(items.id, itemId));
  if (!row) return null;
  const { deletedAt, ...card } = row;
  return { ...card, deleted: deletedAt !== null };
}

export type MoveResult = "moved" | "not_found" | "limit_reached";

export async function moveItem(db: Database, ownerId: string, itemId: string, toWishlistId: string): Promise<MoveResult> {
  const id = await ownedItemId(db, ownerId, itemId);
  const target = await getOwnedWishlist(db, ownerId, toWishlistId);
  if (!id || !target) return "not_found";
  const [current] = await db.select({ wishlistId: items.wishlistId }).from(items).where(eq(items.id, id));
  if (current?.wishlistId === target.id) return "moved";
  if (target.itemCount >= MAX_ITEMS_PER_WISHLIST) return "limit_reached";
  await db.update(items).set({ wishlistId: target.id }).where(eq(items.id, id));
  return "moved";
}
```

В `packages/db/src/index.ts` добавить:
```ts
export * from "./bot";
```

- [ ] **Step 5: Тест проходит**

Run: `pnpm vitest run packages/db packages/core`
Expected: PASS.

- [ ] **Step 6: Проверка и commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add packages/core packages/db
git commit -m "feat(db): bot queries for cards, moving items and reservations; signed reminder link"
```

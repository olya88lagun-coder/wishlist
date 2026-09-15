# Task 3: Репозиторий подарков и вид владельца (`packages/db`)

**Files:**
- Create: `packages/db/src/items.ts`
- Test: `packages/db/src/items.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `Database`, `items`, `reservations`, `users`, `wishlists` (план 1); `isUuid`, `MAX_ITEMS_PER_WISHLIST`, `WishlistSummary`, `getOwnedWishlist`, `createUserFixture` (Task 2); `detectStore`, `ownerReservationView` (core).
- Produces:
  ```ts
  type ItemInput = { title: string; sourceUrl: string | null; priceKopecks: number | null; note: string | null; isMustHave: boolean };
  type OwnerItemView = {
    id: string; title: string; sourceUrl: string | null; store: string | null; priceKopecks: number | null;
    currency: string; note: string | null; isMustHave: boolean; reserved: boolean;
  };
  type OwnerWishlistView = { wishlist: WishlistSummary; surpriseMode: boolean; items: OwnerItemView[] };
  function addItem(db: Database, ownerId: string, wishlistId: string, input: ItemInput): Promise<{ ok: true; itemId: string } | { ok: false; reason: "NOT_FOUND" | "LIMIT_REACHED" }>;
  function updateItem(db: Database, ownerId: string, itemId: string, input: ItemInput): Promise<boolean>;
  function deleteItem(db: Database, ownerId: string, itemId: string): Promise<boolean>;   // мягкое удаление (deleted_at)
  function getOwnerWishlistView(db: Database, ownerId: string, wishlistId: string): Promise<OwnerWishlistView | null>;
  ```
- `sourceUrl` приходит уже нормализованным (`normalizeProductUrl` в форме, Task 6); `store` = `detectStore(sourceUrl).id` или `null`.
- Порядок подарков: сначала «очень хочу», затем новые сверху.

- [ ] **Step 1: Падающие тесты**

`packages/db/src/items.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem, getOwnerWishlistView, type ItemInput, updateItem } from "./items";
import { MAX_ITEMS_PER_WISHLIST } from "./limits";
import { items, reservations, users } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { eq } from "drizzle-orm";
import { createWishlist } from "./wishlists";

let db: Database;
let owner: string;
let stranger: string;
let listId: string;

const headphones: ItemInput = {
  title: "Наушники",
  sourceUrl: "https://www.wildberries.ru/catalog/173937886/detail.aspx",
  priceKopecks: 2499000,
  note: "чёрные",
  isMustHave: false,
};

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  stranger = await createUserFixture(db, "Петя");
  const list = await createWishlist(db, owner, { title: "Маше 30", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
});

async function added(input: ItemInput = headphones) {
  const result = await addItem(db, owner, listId, input);
  if (!result.ok) throw new Error(result.reason);
  return result.itemId;
}

describe("addItem", () => {
  test("adds a manual item and detects the store", async () => {
    await added();
    const view = await getOwnerWishlistView(db, owner, listId);
    expect(view?.items).toEqual([
      expect.objectContaining({ title: "Наушники", store: "wildberries", priceKopecks: 2499000, note: "чёрные", reserved: false }),
    ]);
    expect(view?.wishlist.itemCount).toBe(1);
  });

  test("accepts items without link and price", async () => {
    await added({ title: "Сертификат в SPA", sourceUrl: null, priceKopecks: null, note: null, isMustHave: true });
    const view = await getOwnerWishlistView(db, owner, listId);
    expect(view?.items[0]).toMatchObject({ store: null, sourceUrl: null, priceKopecks: null });
  });

  test("refuses to add into someone else's list", async () => {
    expect(await addItem(db, stranger, listId, headphones)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await addItem(db, owner, "bad-id", headphones)).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  test("stops at the per-list limit, ignoring deleted items", async () => {
    await db.insert(items).values(
      Array.from({ length: MAX_ITEMS_PER_WISHLIST }, (_, i) => ({ wishlistId: listId, title: `#${i}`, parseStatus: "ok" as const })),
    );
    expect(await addItem(db, owner, listId, headphones)).toEqual({ ok: false, reason: "LIMIT_REACHED" });
    const [one] = await db.select({ id: items.id }).from(items).limit(1);
    await deleteItem(db, owner, one!.id);
    expect((await addItem(db, owner, listId, headphones)).ok).toBe(true);
  });
});

describe("updateItem / deleteItem", () => {
  test("owner edits and soft-deletes; stranger cannot", async () => {
    const id = await added();
    expect(await updateItem(db, stranger, id, { ...headphones, title: "Взлом" })).toBe(false);
    expect(await deleteItem(db, stranger, id)).toBe(false);

    expect(await updateItem(db, owner, id, { ...headphones, title: "Наушники Sony", isMustHave: true, sourceUrl: null })).toBe(true);
    expect((await getOwnerWishlistView(db, owner, listId))?.items[0]).toMatchObject({ title: "Наушники Sony", isMustHave: true, store: null });

    expect(await deleteItem(db, owner, id)).toBe(true);
    expect((await getOwnerWishlistView(db, owner, listId))?.items).toEqual([]);
    expect(await updateItem(db, owner, id, headphones)).toBe(false);
  });

  test("malformed ids return false", async () => {
    expect(await updateItem(db, owner, "x", headphones)).toBe(false);
    expect(await deleteItem(db, owner, "x")).toBe(false);
  });
});

describe("getOwnerWishlistView", () => {
  test("orders must-have first, then newest", async () => {
    await added({ ...headphones, title: "Старый" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await added({ ...headphones, title: "Новый" });
    await added({ ...headphones, title: "Мечта", isMustHave: true });
    const titles = (await getOwnerWishlistView(db, owner, listId))?.items.map((i) => i.title);
    expect(titles).toEqual(["Мечта", "Новый", "Старый"]);
  });

  test("returns null for a stranger", async () => {
    expect(await getOwnerWishlistView(db, stranger, listId)).toBeNull();
  });

  test("PRIVACY: shows only a reserved flag and never guest data", async () => {
    const id = await added();
    await db.insert(reservations).values({
      itemId: id, guestName: "СекретнаяАня", guestToken: "tok-secret", cancelToken: "cancel-secret", guestUserId: stranger,
    });
    const view = await getOwnerWishlistView(db, owner, listId);
    expect(view?.items[0]?.reserved).toBe(true);
    const json = JSON.stringify(view);
    for (const secret of ["СекретнаяАня", "tok-secret", "cancel-secret", stranger]) expect(json).not.toContain(secret);
  });

  test("PRIVACY: surprise mode hides even the reserved flag", async () => {
    const id = await added();
    await db.insert(reservations).values({ itemId: id, guestName: "Аня", guestToken: "t", cancelToken: "c" });
    await db.update(users).set({ surpriseMode: true }).where(eq(users.id, owner));
    const view = await getOwnerWishlistView(db, owner, listId);
    expect(view).toMatchObject({ surpriseMode: true });
    expect(view?.items[0]?.reserved).toBe(false);
  });

  test("cancelled reservations do not count", async () => {
    const id = await added();
    await db.insert(reservations).values({ itemId: id, guestName: "Аня", guestToken: "t", cancelToken: "c", status: "cancelled" });
    expect((await getOwnerWishlistView(db, owner, listId))?.items[0]?.reserved).toBe(false);
  });
});
```

Run: `pnpm vitest run packages/db/src/items.test.ts`
Expected: FAIL — `Cannot find module './items'`.

- [ ] **Step 2: Реализация**

`packages/db/src/items.ts`:
```ts
import { detectStore, ownerReservationView } from "@wishlist/core";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { isUuid } from "./errors";
import { MAX_ITEMS_PER_WISHLIST } from "./limits";
import { items, reservations, users, wishlists } from "./schema";
import type { Database } from "./types";
import { getOwnedWishlist, type WishlistSummary } from "./wishlists";

export type ItemInput = { title: string; sourceUrl: string | null; priceKopecks: number | null; note: string | null; isMustHave: boolean };

export type OwnerItemView = {
  id: string;
  title: string;
  sourceUrl: string | null;
  store: string | null;
  priceKopecks: number | null;
  currency: string;
  note: string | null;
  isMustHave: boolean;
  reserved: boolean;
};

export type OwnerWishlistView = { wishlist: WishlistSummary; surpriseMode: boolean; items: OwnerItemView[] };

// Владельцу нужна только сама наличность брони; данные гостя сюда не выбираются вовсе
const REDACTED_RESERVATION = { guestUserId: null, guestToken: null, guestName: "" };

function itemValues(input: ItemInput) {
  return {
    title: input.title,
    sourceUrl: input.sourceUrl,
    normalizedUrl: input.sourceUrl,
    store: input.sourceUrl ? detectStore(input.sourceUrl).id : null,
    priceKopecks: input.priceKopecks,
    note: input.note,
    isMustHave: input.isMustHave,
  };
}

async function ownedItemId(db: Database, ownerId: string, itemId: string): Promise<string | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({ id: items.id })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .where(and(eq(items.id, itemId), eq(wishlists.ownerId, ownerId), isNull(items.deletedAt)));
  return row?.id ?? null;
}

export async function addItem(
  db: Database,
  ownerId: string,
  wishlistId: string,
  input: ItemInput,
): Promise<{ ok: true; itemId: string } | { ok: false; reason: "NOT_FOUND" | "LIMIT_REACHED" }> {
  const wishlist = await getOwnedWishlist(db, ownerId, wishlistId);
  if (!wishlist) return { ok: false, reason: "NOT_FOUND" };
  const [existing] = await db
    .select({ total: count() })
    .from(items)
    .where(and(eq(items.wishlistId, wishlistId), isNull(items.deletedAt)));
  if ((existing?.total ?? 0) >= MAX_ITEMS_PER_WISHLIST) return { ok: false, reason: "LIMIT_REACHED" };
  const [row] = await db
    .insert(items)
    .values({ wishlistId, parseStatus: "ok", ...itemValues(input) })
    .returning({ id: items.id });
  return { ok: true, itemId: row!.id };
}

export async function updateItem(db: Database, ownerId: string, itemId: string, input: ItemInput): Promise<boolean> {
  const id = await ownedItemId(db, ownerId, itemId);
  if (!id) return false;
  await db.update(items).set(itemValues(input)).where(eq(items.id, id));
  return true;
}

export async function deleteItem(db: Database, ownerId: string, itemId: string): Promise<boolean> {
  const id = await ownedItemId(db, ownerId, itemId);
  if (!id) return false;
  await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, id));
  return true;
}

export async function getOwnerWishlistView(db: Database, ownerId: string, wishlistId: string): Promise<OwnerWishlistView | null> {
  const wishlist = await getOwnedWishlist(db, ownerId, wishlistId);
  if (!wishlist) return null;
  const [owner] = await db.select({ surpriseMode: users.surpriseMode }).from(users).where(eq(users.id, ownerId));
  const surpriseMode = owner?.surpriseMode ?? false;

  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      sourceUrl: items.sourceUrl,
      store: items.store,
      priceKopecks: items.priceKopecks,
      currency: items.currency,
      note: items.note,
      isMustHave: items.isMustHave,
      hasActiveReservation: sql<boolean>`exists (select 1 from ${reservations} where ${reservations.itemId} = ${items.id} and ${reservations.status} = 'active')`,
    })
    .from(items)
    .where(and(eq(items.wishlistId, wishlistId), isNull(items.deletedAt)))
    .orderBy(desc(items.isMustHave), desc(items.createdAt), desc(items.id));

  return {
    wishlist,
    surpriseMode,
    items: rows.map(({ hasActiveReservation, ...item }) => ({
      ...item,
      reserved: ownerReservationView(
        { ownerId, active: hasActiveReservation ? REDACTED_RESERVATION : null },
        surpriseMode,
      ).reserved,
    })),
  };
}
```

`packages/db/src/index.ts` — добавить строку:
```ts
export * from "./items";
```

- [ ] **Step 3: Тесты проходят**

Run: `pnpm vitest run packages/db && pnpm typecheck`
Expected: PASS. Если `exists(...)` возвращается из PGlite строкой `"t"`/`"f"` вместо boolean — заменить в select на `sql<boolean>\`(exists (...))::boolean\`` и при необходимости маппить `hasActiveReservation === true || hasActiveReservation === "t"`; зафиксировать в комментарии, какой драйвер как отдаёт.

- [ ] **Step 4: Commit**

```bash
git add packages/db
git commit -m "feat(db): items repository and privacy-safe owner view"
```

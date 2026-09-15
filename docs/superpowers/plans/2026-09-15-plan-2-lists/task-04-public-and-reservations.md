# Task 4: Публичный вид списка, бронирование и отмена (`packages/db`)

**Files:**
- Create: `packages/db/src/public-view.ts`, `packages/db/src/reservations.ts`
- Test: `packages/db/src/public-view.test.ts`, `packages/db/src/reservations.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `Database`, `items`, `reservations`, `users`, `wishlists`; `isUniqueViolation`, `isUuid`, `createUserFixture`, `createWishlist`, `WishlistOccasion` (Task 2); `addItem`, `deleteItem`, `ItemInput` (Task 3); `decideReserve`, `decideCancel`, `guestReservationView`, `ownerReservationView`, `isValidSlug`, `Viewer` (core).
- Produces:
  ```ts
  // public-view.ts
  type PublicItemStatus = "free" | "reserved_by_me" | "reserved_by_other";
  type PublicItemView = {
    id: string; title: string; sourceUrl: string | null; store: string | null; priceKopecks: number | null;
    currency: string; note: string | null; isMustHave: boolean; status: PublicItemStatus;
  };
  type PublicWishlistView = {
    wishlist: { id: string; title: string; occasion: WishlistOccasion; eventDate: string | null; slug: string };
    ownerName: string; isOwner: boolean; items: PublicItemView[];
  };
  function getPublicWishlist(db: Database, slug: string, viewer: Viewer): Promise<PublicWishlistView | null>;
  // reservations.ts
  type ReserveResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "OWNER_CANNOT_RESERVE" | "ALREADY_RESERVED" | "NO_IDENTITY" | "INVALID_NAME" };
  type CancelResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_RESERVED" | "NOT_YOUR_RESERVATION" };
  function reserveItem(db: Database, p: { slug: string; itemId: string; viewer: Viewer; guestName: string }): Promise<ReserveResult>;
  function cancelReservation(db: Database, p: { slug: string; itemId: string; viewer: Viewer }): Promise<CancelResult>;
  ```
- Когда владелец смотрит свою публичную страницу (`isOwner = true`), статусы строятся по правилам владельца: `reserved_by_other`, если бронь есть и режим сюрприза выключен, иначе `free`. Кнопки брони UI для владельца не показывает.
- `cancel_token` генерируется и сохраняется для будущей отмены по ссылке из бота (план 4); в этом плане наружу не отдаётся.

- [ ] **Step 1: Падающие тесты публичного вида**

`packages/db/src/public-view.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem } from "./items";
import { getPublicWishlist } from "./public-view";
import { reservations, users } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

let db: Database;
let owner: string;
let guestUser: string;
let slug: string;
let freeId: string;
let reservedId: string;

const anna = { userId: null, guestToken: "tok-anna" };
const petya = { userId: null, guestToken: "tok-petya" };
const item = { sourceUrl: null, priceKopecks: 100000, note: null, isMustHave: false };

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  guestUser = await createUserFixture(db, "Оля");
  const list = await createWishlist(db, owner, { title: "Маше 30", occasion: "birthday", eventDate: "2026-03-14" });
  if (!list.ok) throw new Error("setup");
  slug = list.wishlist.slug;
  const a = await addItem(db, owner, list.wishlist.id, { ...item, title: "Свеча" });
  const b = await addItem(db, owner, list.wishlist.id, { ...item, title: "Наушники" });
  if (!a.ok || !b.ok) throw new Error("setup");
  freeId = a.itemId;
  reservedId = b.itemId;
  await db.insert(reservations).values({ itemId: reservedId, guestName: "СекретнаяАня", guestToken: "tok-anna", cancelToken: "cancel-secret" });
});

const statusOf = (view: Awaited<ReturnType<typeof getPublicWishlist>>, id: string) => view?.items.find((i) => i.id === id)?.status;

describe("getPublicWishlist", () => {
  test("shows list header and owner first name", async () => {
    const view = await getPublicWishlist(db, slug, petya);
    expect(view).toMatchObject({ ownerName: "Маша", isOwner: false, wishlist: { title: "Маше 30", eventDate: "2026-03-14", slug } });
  });

  test("statuses depend on who is looking", async () => {
    expect(statusOf(await getPublicWishlist(db, slug, anna), reservedId)).toBe("reserved_by_me");
    expect(statusOf(await getPublicWishlist(db, slug, petya), reservedId)).toBe("reserved_by_other");
    expect(statusOf(await getPublicWishlist(db, slug, petya), freeId)).toBe("free");
  });

  test("owner sees reserved_by_other, or free in surprise mode", async () => {
    const asOwner = { userId: owner, guestToken: null };
    const view = await getPublicWishlist(db, slug, asOwner);
    expect(view?.isOwner).toBe(true);
    expect(statusOf(view, reservedId)).toBe("reserved_by_other");
    await db.update(users).set({ surpriseMode: true }).where(eq(users.id, owner));
    expect(statusOf(await getPublicWishlist(db, slug, asOwner), reservedId)).toBe("free");
  });

  test("PRIVACY: never exposes guest names or tokens", async () => {
    const json = JSON.stringify(await getPublicWishlist(db, slug, anna));
    for (const secret of ["СекретнаяАня", "tok-anna", "cancel-secret"]) expect(json).not.toContain(secret);
  });

  test("hides deleted items and returns null for unknown or malformed slugs", async () => {
    await deleteItem(db, owner, freeId);
    expect((await getPublicWishlist(db, slug, petya))?.items.map((i) => i.id)).toEqual([reservedId]);
    expect(await getPublicWishlist(db, "AAAAAAAAAA", petya)).toBeNull();
    expect(await getPublicWishlist(db, "../etc", petya)).toBeNull();
  });

  test("matches a logged-in guest by user id", async () => {
    await db.insert(reservations).values({ itemId: freeId, guestName: "Оля", guestUserId: guestUser, cancelToken: "c2" });
    expect(statusOf(await getPublicWishlist(db, slug, { userId: guestUser, guestToken: null }), freeId)).toBe("reserved_by_me");
  });
});
```

- [ ] **Step 2: Падающие тесты броней**

`packages/db/src/reservations.test.ts`:
```ts
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem } from "./items";
import { cancelReservation, reserveItem } from "./reservations";
import { reservations } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

let db: Database;
let owner: string;
let slug: string;
let otherSlug: string;
let itemId: string;

const anna = { userId: null, guestToken: "tok-anna" };
const petya = { userId: null, guestToken: "tok-petya" };

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  const list = await createWishlist(db, owner, { title: "Маше 30", occasion: "birthday", eventDate: null });
  const other = await createWishlist(db, owner, { title: "Новый год", occasion: "new_year", eventDate: null });
  if (!list.ok || !other.ok) throw new Error("setup");
  slug = list.wishlist.slug;
  otherSlug = other.wishlist.slug;
  const added = await addItem(db, owner, list.wishlist.id, { title: "Наушники", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

async function activeCount() {
  const rows = await db.select().from(reservations).where(and(eq(reservations.itemId, itemId), eq(reservations.status, "active")));
  return rows.length;
}

describe("reserveItem", () => {
  test("guest reserves a free item with a trimmed name and a secret cancel token", async () => {
    expect(await reserveItem(db, { slug, itemId, viewer: anna, guestName: "  Аня " })).toEqual({ ok: true });
    const [row] = await db.select().from(reservations).where(eq(reservations.itemId, itemId));
    expect(row).toMatchObject({ guestName: "Аня", guestToken: "tok-anna", status: "active" });
    expect(row?.cancelToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  test("second guest gets ALREADY_RESERVED", async () => {
    await reserveItem(db, { slug, itemId, viewer: anna, guestName: "Аня" });
    expect(await reserveItem(db, { slug, itemId, viewer: petya, guestName: "Петя" })).toEqual({ ok: false, reason: "ALREADY_RESERVED" });
  });

  test("two simultaneous reservations: exactly one wins", async () => {
    const results = await Promise.all([
      reserveItem(db, { slug, itemId, viewer: anna, guestName: "Аня" }),
      reserveItem(db, { slug, itemId, viewer: petya, guestName: "Петя" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, reason: "ALREADY_RESERVED" });
    expect(await activeCount()).toBe(1);
  });

  test("owner cannot reserve; invalid name and missing identity are rejected", async () => {
    expect(await reserveItem(db, { slug, itemId, viewer: { userId: owner, guestToken: "t" }, guestName: "Маша" })).toEqual({ ok: false, reason: "OWNER_CANNOT_RESERVE" });
    expect(await reserveItem(db, { slug, itemId, viewer: anna, guestName: " " })).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(await reserveItem(db, { slug, itemId, viewer: { userId: null, guestToken: null }, guestName: "X" })).toEqual({ ok: false, reason: "NO_IDENTITY" });
  });

  test("NOT_FOUND for wrong slug, deleted item or malformed ids", async () => {
    expect(await reserveItem(db, { slug: otherSlug, itemId, viewer: anna, guestName: "Аня" })).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await reserveItem(db, { slug, itemId: "nope", viewer: anna, guestName: "Аня" })).toEqual({ ok: false, reason: "NOT_FOUND" });
    await deleteItem(db, owner, itemId);
    expect(await reserveItem(db, { slug, itemId, viewer: anna, guestName: "Аня" })).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("cancelReservation", () => {
  test("only the guest who reserved can cancel, then the item is free again", async () => {
    await reserveItem(db, { slug, itemId, viewer: anna, guestName: "Аня" });
    expect(await cancelReservation(db, { slug, itemId, viewer: petya })).toEqual({ ok: false, reason: "NOT_YOUR_RESERVATION" });
    expect(await cancelReservation(db, { slug, itemId, viewer: { userId: owner, guestToken: null } })).toEqual({ ok: false, reason: "NOT_YOUR_RESERVATION" });
    expect(await cancelReservation(db, { slug, itemId, viewer: anna })).toEqual({ ok: true });
    expect(await activeCount()).toBe(0);
    expect(await reserveItem(db, { slug, itemId, viewer: petya, guestName: "Петя" })).toEqual({ ok: true });
  });

  test("NOT_RESERVED for a free item, NOT_FOUND for a wrong slug", async () => {
    expect(await cancelReservation(db, { slug, itemId, viewer: anna })).toEqual({ ok: false, reason: "NOT_RESERVED" });
    expect(await cancelReservation(db, { slug: otherSlug, itemId, viewer: anna })).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});
```

Run: `pnpm vitest run packages/db/src/public-view.test.ts packages/db/src/reservations.test.ts`
Expected: FAIL — `Cannot find module './public-view'` и `'./reservations'`.

- [ ] **Step 3: Реализация публичного вида**

`packages/db/src/public-view.ts`:
```ts
import { guestReservationView, isValidSlug, ownerReservationView, type Viewer } from "@wishlist/core";
import { and, desc, eq, isNull } from "drizzle-orm";
import { items, reservations, users, wishlists } from "./schema";
import type { Database } from "./types";
import type { WishlistOccasion } from "./wishlists";

export type PublicItemStatus = "free" | "reserved_by_me" | "reserved_by_other";

export type PublicItemView = {
  id: string;
  title: string;
  sourceUrl: string | null;
  store: string | null;
  priceKopecks: number | null;
  currency: string;
  note: string | null;
  isMustHave: boolean;
  status: PublicItemStatus;
};

export type PublicWishlistView = {
  wishlist: { id: string; title: string; occasion: WishlistOccasion; eventDate: string | null; slug: string };
  ownerName: string;
  isOwner: boolean;
  items: PublicItemView[];
};

const REDACTED_NAME = "";

function firstName(displayName: string): string {
  return displayName.split(" ")[0] ?? displayName;
}

export async function getPublicWishlist(db: Database, slug: string, viewer: Viewer): Promise<PublicWishlistView | null> {
  if (!isValidSlug(slug)) return null;
  const [header] = await db
    .select({
      id: wishlists.id,
      title: wishlists.title,
      occasion: wishlists.occasion,
      eventDate: wishlists.eventDate,
      slug: wishlists.slug,
      ownerId: wishlists.ownerId,
      ownerDisplayName: users.displayName,
      surpriseMode: users.surpriseMode,
    })
    .from(wishlists)
    .innerJoin(users, eq(users.id, wishlists.ownerId))
    .where(eq(wishlists.slug, slug));
  if (!header) return null;

  // guestUserId/guestToken нужны только для сравнения со зрителем и не попадают в результат
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
      reservationGuestUserId: reservations.guestUserId,
      reservationGuestToken: reservations.guestToken,
      reservationId: reservations.id,
    })
    .from(items)
    .leftJoin(reservations, and(eq(reservations.itemId, items.id), eq(reservations.status, "active")))
    .where(and(eq(items.wishlistId, header.id), isNull(items.deletedAt)))
    .orderBy(desc(items.isMustHave), desc(items.createdAt), desc(items.id));

  const isOwner = viewer.userId !== null && viewer.userId === header.ownerId;

  const publicItems = rows.map(({ reservationGuestUserId, reservationGuestToken, reservationId, ...item }) => {
    const state = {
      ownerId: header.ownerId,
      active: reservationId
        ? { guestUserId: reservationGuestUserId, guestToken: reservationGuestToken, guestName: REDACTED_NAME }
        : null,
    };
    const status: PublicItemStatus = isOwner
      ? ownerReservationView(state, header.surpriseMode).reserved ? "reserved_by_other" : "free"
      : guestReservationView(state, viewer).status;
    return { ...item, status };
  });

  return {
    wishlist: { id: header.id, title: header.title, occasion: header.occasion, eventDate: header.eventDate, slug: header.slug },
    ownerName: firstName(header.ownerDisplayName),
    isOwner,
    items: publicItems,
  };
}
```

- [ ] **Step 4: Реализация броней**

`packages/db/src/reservations.ts`:
```ts
import { randomBytes } from "node:crypto";
import { decideCancel, decideReserve, isValidSlug, type ItemReservationState, type Viewer } from "@wishlist/core";
import { and, eq, isNull } from "drizzle-orm";
import { isUniqueViolation, isUuid } from "./errors";
import { items, reservations, wishlists } from "./schema";
import type { Database } from "./types";

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "OWNER_CANNOT_RESERVE" | "ALREADY_RESERVED" | "NO_IDENTITY" | "INVALID_NAME" };

export type CancelResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_RESERVED" | "NOT_YOUR_RESERVATION" };

const CANCEL_TOKEN_BYTES = 24;

async function loadState(db: Database, slug: string, itemId: string): Promise<{ state: ItemReservationState; reservationId: string | null } | null> {
  if (!isValidSlug(slug) || !isUuid(itemId)) return null;
  const [row] = await db
    .select({
      ownerId: wishlists.ownerId,
      reservationId: reservations.id,
      guestUserId: reservations.guestUserId,
      guestToken: reservations.guestToken,
      guestName: reservations.guestName,
    })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .leftJoin(reservations, and(eq(reservations.itemId, items.id), eq(reservations.status, "active")))
    .where(and(eq(items.id, itemId), eq(wishlists.slug, slug), isNull(items.deletedAt)));
  if (!row) return null;
  const active = row.reservationId
    ? { guestUserId: row.guestUserId, guestToken: row.guestToken, guestName: row.guestName ?? "" }
    : null;
  return { state: { ownerId: row.ownerId, active }, reservationId: row.reservationId };
}

export async function reserveItem(
  db: Database,
  p: { slug: string; itemId: string; viewer: Viewer; guestName: string },
): Promise<ReserveResult> {
  const loaded = await loadState(db, p.slug, p.itemId);
  if (!loaded) return { ok: false, reason: "NOT_FOUND" };
  const decision = decideReserve(loaded.state, p.viewer, p.guestName);
  if (!decision.ok) return decision;
  try {
    await db.insert(reservations).values({
      itemId: p.itemId,
      guestUserId: p.viewer.userId,
      guestToken: p.viewer.guestToken,
      guestName: decision.guestName,
      cancelToken: randomBytes(CANCEL_TOKEN_BYTES).toString("base64url"),
    });
    return { ok: true };
  } catch (error) {
    // Гонка двух гостей: частичный уникальный индекс пропускает только одну активную бронь
    if (isUniqueViolation(error)) return { ok: false, reason: "ALREADY_RESERVED" };
    throw error;
  }
}

export async function cancelReservation(db: Database, p: { slug: string; itemId: string; viewer: Viewer }): Promise<CancelResult> {
  const loaded = await loadState(db, p.slug, p.itemId);
  if (!loaded) return { ok: false, reason: "NOT_FOUND" };
  const decision = decideCancel(loaded.state, p.viewer);
  if (!decision.ok) return decision;
  await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, loaded.reservationId!));
  return { ok: true };
}
```

`packages/db/src/index.ts` — добавить строки:
```ts
export * from "./public-view";
export * from "./reservations";
```

- [ ] **Step 5: Тесты проходят**

Run: `pnpm vitest run packages/db && pnpm typecheck`
Expected: PASS. Тест «two simultaneous reservations» на PGlite выполняется в одном соединении последовательно, поэтому второй запрос отсекается уже `decideReserve`, а не индексом; ветку с индексом покрывает тест схемы из плана 1 (`schema.test.ts`). Оба пути возвращают `ALREADY_RESERVED`.

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "feat(db): public wishlist view, reserve and cancel with privacy guarantees"
```

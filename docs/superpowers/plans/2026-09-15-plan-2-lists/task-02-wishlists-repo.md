# Task 2: Репозиторий списков (`packages/db`)

**Files:**
- Create: `packages/db/src/limits.ts`, `packages/db/src/errors.ts`, `packages/db/src/test-fixtures.ts`, `packages/db/src/wishlists.ts`
- Test: `packages/db/src/wishlists.test.ts`
- Modify: `packages/db/package.json` (зависимость на `@wishlist/core`), `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `Database`, `wishlists`, `items`, `users`, `occasionEnum` (план 1); `generateSlug` (Task 1).
- Produces:
  ```ts
  // limits.ts
  const MAX_WISHLISTS_PER_USER = 30;
  const MAX_ITEMS_PER_WISHLIST = 150;
  const WISHLIST_TITLE_MAX = 80; const ITEM_TITLE_MAX = 200; const ITEM_NOTE_MAX = 300;
  // errors.ts
  function isUniqueViolation(error: unknown): boolean;   // SQLSTATE 23505, в т.ч. внутри error.cause
  function isUuid(value: string): boolean;
  // test-fixtures.ts (только для тестов)
  function createUserFixture(db: Database, displayName?: string): Promise<string>;   // id
  // wishlists.ts
  type WishlistOccasion = "birthday" | "new_year" | "other";
  type WishlistInput = { title: string; occasion: WishlistOccasion; eventDate: string | null };
  type WishlistSummary = { id: string; title: string; occasion: WishlistOccasion; eventDate: string | null; slug: string; itemCount: number };
  function createWishlist(db: Database, ownerId: string, input: WishlistInput): Promise<{ ok: true; wishlist: WishlistSummary } | { ok: false; reason: "LIMIT_REACHED" }>;
  function listWishlistsForOwner(db: Database, ownerId: string): Promise<WishlistSummary[]>;   // новые сверху
  function getOwnedWishlist(db: Database, ownerId: string, wishlistId: string): Promise<WishlistSummary | null>;
  function updateWishlist(db: Database, ownerId: string, wishlistId: string, input: WishlistInput): Promise<boolean>;
  function deleteWishlist(db: Database, ownerId: string, wishlistId: string): Promise<boolean>;
  ```

Входные данные в репозиторий приходят уже провалидированными (zod в Task 6); репозиторий отвечает за владение, лимиты и уникальность slug.

- [x] **Step 1: Зависимость db → core**

В `packages/db/package.json` в `dependencies` добавить `"@wishlist/core": "workspace:*"`.

Run: `pnpm install`
Expected: `Done`, lock-файл обновлён.

- [x] **Step 2: Лимиты, ошибки, фикстуры**

`packages/db/src/limits.ts`:
```ts
export const MAX_WISHLISTS_PER_USER = 30;
export const MAX_ITEMS_PER_WISHLIST = 150;
export const WISHLIST_TITLE_MAX = 80;
export const ITEM_TITLE_MAX = 200;
export const ITEM_NOTE_MAX = 300;
```

`packages/db/src/errors.ts`:
```ts
const UNIQUE_VIOLATION = "23505";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  if (typeof code === "string") return code;
  return sqlState(cause);
}

export function isUniqueViolation(error: unknown): boolean {
  return sqlState(error) === UNIQUE_VIOLATION;
}

// Невалидный uuid в запросе к Postgres даёт ошибку 22P02 — отсекаем такие id до запроса
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
```

`packages/db/src/test-fixtures.ts`:
```ts
import { users } from "./schema";
import type { Database } from "./types";

export async function createUserFixture(db: Database, displayName = "Маша"): Promise<string> {
  const [user] = await db.insert(users).values({ displayName }).returning({ id: users.id });
  return user!.id;
}
```

- [x] **Step 3: Падающие тесты**

`packages/db/src/wishlists.test.ts`:
```ts
import { isValidSlug } from "@wishlist/core";
import { beforeEach, describe, expect, test } from "vitest";
import { MAX_WISHLISTS_PER_USER } from "./limits";
import { items } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist, deleteWishlist, getOwnedWishlist, listWishlistsForOwner, updateWishlist } from "./wishlists";

let db: Database;
let owner: string;
let stranger: string;
const input = { title: "Маше тридцать", occasion: "birthday" as const, eventDate: "2026-03-14" };

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  stranger = await createUserFixture(db, "Петя");
});

async function created() {
  const result = await createWishlist(db, owner, input);
  if (!result.ok) throw new Error("setup");
  return result.wishlist;
}

describe("createWishlist", () => {
  test("creates a list with a valid random slug and zero items", async () => {
    const list = await created();
    expect(list).toMatchObject({ title: "Маше тридцать", occasion: "birthday", eventDate: "2026-03-14", itemCount: 0 });
    expect(isValidSlug(list.slug)).toBe(true);
  });

  test("stops at the per-user limit", async () => {
    for (let i = 0; i < MAX_WISHLISTS_PER_USER; i++) await createWishlist(db, owner, { ...input, title: `Список ${i}` });
    expect(await createWishlist(db, owner, input)).toEqual({ ok: false, reason: "LIMIT_REACHED" });
    expect((await createWishlist(db, stranger, input)).ok).toBe(true);
  });
});

describe("listWishlistsForOwner", () => {
  test("returns only own lists, newest first, counting non-deleted items", async () => {
    const first = await created();
    await new Promise((resolve) => setTimeout(resolve, 5)); // разные created_at
    const second = await created();
    await createWishlist(db, stranger, { ...input, title: "Чужой" });
    await db.insert(items).values([
      { wishlistId: first.id, title: "A", parseStatus: "ok" },
      { wishlistId: first.id, title: "B", parseStatus: "ok", deletedAt: new Date() },
    ]);
    const lists = await listWishlistsForOwner(db, owner);
    expect(lists.map((l) => l.id)).toEqual([second.id, first.id]);
    expect(lists.find((l) => l.id === first.id)?.itemCount).toBe(1);
  });
});

describe("ownership", () => {
  test("stranger cannot read, update or delete someone else's list", async () => {
    const list = await created();
    expect(await getOwnedWishlist(db, stranger, list.id)).toBeNull();
    expect(await updateWishlist(db, stranger, list.id, { ...input, title: "Взлом" })).toBe(false);
    expect(await deleteWishlist(db, stranger, list.id)).toBe(false);
    expect((await getOwnedWishlist(db, owner, list.id))?.title).toBe("Маше тридцать");
  });

  test("owner can update and delete", async () => {
    const list = await created();
    expect(await updateWishlist(db, owner, list.id, { title: "Новый год", occasion: "new_year", eventDate: null })).toBe(true);
    expect(await getOwnedWishlist(db, owner, list.id)).toMatchObject({ title: "Новый год", occasion: "new_year", eventDate: null, slug: list.slug });
    expect(await deleteWishlist(db, owner, list.id)).toBe(true);
    expect(await getOwnedWishlist(db, owner, list.id)).toBeNull();
  });

  test("malformed ids return null/false instead of throwing", async () => {
    expect(await getOwnedWishlist(db, owner, "not-a-uuid")).toBeNull();
    expect(await updateWishlist(db, owner, "../../etc", input)).toBe(false);
    expect(await deleteWishlist(db, owner, "1")).toBe(false);
  });
});
```

Run: `pnpm vitest run packages/db/src/wishlists.test.ts`
Expected: FAIL — `Cannot find module './wishlists'`.

- [x] **Step 4: Реализация**

`packages/db/src/wishlists.ts`:
```ts
import { generateSlug } from "@wishlist/core";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { isUniqueViolation, isUuid } from "./errors";
import { MAX_WISHLISTS_PER_USER } from "./limits";
import { items, occasionEnum, wishlists } from "./schema";
import type { Database } from "./types";

export type WishlistOccasion = (typeof occasionEnum.enumValues)[number];
export type WishlistInput = { title: string; occasion: WishlistOccasion; eventDate: string | null };
export type WishlistSummary = {
  id: string;
  title: string;
  occasion: WishlistOccasion;
  eventDate: string | null;
  slug: string;
  itemCount: number;
};

const SLUG_ATTEMPTS = 3;

const summaryColumns = {
  id: wishlists.id,
  title: wishlists.title,
  occasion: wishlists.occasion,
  eventDate: wishlists.eventDate,
  slug: wishlists.slug,
  itemCount: sql<number>`count(${items.id})::int`,
};

function summaryQuery(db: Database) {
  return db
    .select(summaryColumns)
    .from(wishlists)
    .leftJoin(items, and(eq(items.wishlistId, wishlists.id), isNull(items.deletedAt)))
    .groupBy(wishlists.id);
}

export async function createWishlist(
  db: Database,
  ownerId: string,
  input: WishlistInput,
): Promise<{ ok: true; wishlist: WishlistSummary } | { ok: false; reason: "LIMIT_REACHED" }> {
  const [existing] = await db.select({ total: count() }).from(wishlists).where(eq(wishlists.ownerId, ownerId));
  if ((existing?.total ?? 0) >= MAX_WISHLISTS_PER_USER) return { ok: false, reason: "LIMIT_REACHED" };

  for (let attempt = 1; ; attempt++) {
    try {
      const [row] = await db
        .insert(wishlists)
        .values({ ownerId, title: input.title, occasion: input.occasion, eventDate: input.eventDate, slug: generateSlug() })
        .returning({ id: wishlists.id, title: wishlists.title, occasion: wishlists.occasion, eventDate: wishlists.eventDate, slug: wishlists.slug });
      return { ok: true, wishlist: { ...row!, itemCount: 0 } };
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= SLUG_ATTEMPTS) throw error;
    }
  }
}

export async function listWishlistsForOwner(db: Database, ownerId: string): Promise<WishlistSummary[]> {
  return summaryQuery(db).where(eq(wishlists.ownerId, ownerId)).orderBy(desc(wishlists.createdAt), desc(wishlists.id));
}

export async function getOwnedWishlist(db: Database, ownerId: string, wishlistId: string): Promise<WishlistSummary | null> {
  if (!isUuid(wishlistId)) return null;
  const [row] = await summaryQuery(db).where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, ownerId)));
  return row ?? null;
}

export async function updateWishlist(db: Database, ownerId: string, wishlistId: string, input: WishlistInput): Promise<boolean> {
  if (!isUuid(wishlistId)) return false;
  const updated = await db
    .update(wishlists)
    .set({ title: input.title, occasion: input.occasion, eventDate: input.eventDate })
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, ownerId)))
    .returning({ id: wishlists.id });
  return updated.length > 0;
}

export async function deleteWishlist(db: Database, ownerId: string, wishlistId: string): Promise<boolean> {
  if (!isUuid(wishlistId)) return false;
  const deleted = await db
    .delete(wishlists)
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, ownerId)))
    .returning({ id: wishlists.id });
  return deleted.length > 0;
}
```

`packages/db/src/index.ts`:
```ts
export * as schema from "./schema";
export * from "./schema";
export type { Database } from "./types";
export { createDb } from "./client";
export * from "./users";
export * from "./limits";
export { isUuid } from "./errors";
export * from "./wishlists";
```

- [x] **Step 5: Тесты проходят**

Run: `pnpm vitest run packages/db && pnpm typecheck`
Expected: PASS (все тесты db, включая 5 новых).

- [x] **Step 6: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): wishlists repository with ownership checks and limits"
```

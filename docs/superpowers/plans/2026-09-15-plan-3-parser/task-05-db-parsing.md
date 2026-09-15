# Task 5: База — кэш парсинга, pending-подарки, применение результата

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/items.ts`, `packages/db/src/public-view.ts`, `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0001_*.sql` (генерируется), `packages/db/src/parsing.ts`
- Modify: `apps/web/src/app/lists/[id]/actions.ts` (новые типы результатов `addItem`/`updateItem`)
- Test: `packages/db/src/parsing.test.ts`, дополнения в `packages/db/src/items.test.ts`, `packages/db/src/public-view.test.ts`

**Interfaces:**
- Consumes: `items`, `parseStatusEnum`, `isUuid`, `createTestDb`, `createUserFixture`, `createWishlist`, `addItem` (планы 1–2).
- Produces:
  ```ts
  // schema.ts
  const parseCache: PgTable /* parse_cache: normalized_url PK, result jsonb, fetched_at timestamptz */;
  type ItemParseStatus = "pending" | "ok" | "partial" | "failed";
  // items.ts (изменения)
  function addItem(...): Promise<{ ok: true; itemId: string; needsParsing: boolean } | { ok: false; reason: "NOT_FOUND" | "LIMIT_REACHED" }>;
  function updateItem(db, ownerId, itemId, input): Promise<{ ok: true; needsParsing: boolean } | { ok: false }>;
  type OwnerItemView = { ...прежние поля; imageKey: string | null; parseStatus: ItemParseStatus };
  // public-view.ts (изменения)
  type PublicItemView = { ...прежние поля; imageKey: string | null };
  // parsing.ts
  type ItemForParsing = { id: string; sourceUrl: string; hasImage: boolean };
  type ParsedItemUpdate = { normalizedUrl: string; store: string; title: string | null; description: string | null; priceKopecks: number | null; imageKey: string | null };
  const PARSE_CACHE_TTL_MS = 86_400_000;
  const PARSE_CACHE_KEEP_MS = 604_800_000;
  function getItemForParsing(db: Database, itemId: string): Promise<ItemForParsing | null>;
  function applyParseResult(db: Database, itemId: string, sourceUrl: string, update: ParsedItemUpdate): Promise<boolean>;
  function readParseCache(db: Database, normalizedUrl: string, now?: Date): Promise<unknown | null>;
  function writeParseCache(db: Database, normalizedUrl: string, result: unknown, now?: Date): Promise<void>;
  function pruneParseCache(db: Database, now?: Date): Promise<number>;
  ```
- Правила: подарок со ссылкой создаётся `pending`; без ссылки — `ok`. Правка владельца: смена ссылки на другую → `pending`, фото и описание сбрасываются; ссылка убрана → фото сбрасывается; иначе статус становится `ok` (владелец сам подтвердил данные, подсказка «впишите» исчезает). `applyParseResult` пишет только в пустые поля, и только пока подарок `pending`, не удалён и с той же ссылкой; статус считается в SQL по итоговым значениям: нет названия → `failed`, нет цены → `partial`, иначе `ok`.

- [x] **Step 1: Схема и миграция**

В `packages/db/src/schema.ts`:
1. В импорт из `drizzle-orm/pg-core` добавить `jsonb`.
2. После `export type AuthProvider = ...` добавить:
```ts
export type ItemParseStatus = (typeof parseStatusEnum.enumValues)[number];
```
3. В конец файла:
```ts
export const parseCache = pgTable("parse_cache", {
  normalizedUrl: text("normalized_url").primaryKey(),
  result: jsonb("result").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Run: `pnpm --filter @wishlist/db db:generate`
Expected: создан `packages/db/drizzle/0001_<имя>.sql` с `CREATE TABLE "parse_cache"` (три колонки, `PRIMARY KEY` по `normalized_url`) и обновлены `drizzle/meta/_journal.json`, `0001_snapshot.json`. Других изменений в SQL нет — если есть, схема разошлась со снимком: остановиться и разобраться.

- [x] **Step 2: Тесты репозитория парсинга**

`packages/db/src/parsing.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem, getOwnerWishlistView, updateItem } from "./items";
import {
  applyParseResult,
  getItemForParsing,
  PARSE_CACHE_KEEP_MS,
  PARSE_CACHE_TTL_MS,
  type ParsedItemUpdate,
  pruneParseCache,
  readParseCache,
  writeParseCache,
} from "./parsing";
import { items, parseCache } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

const WB = "https://www.wildberries.ru/catalog/173937886/detail.aspx";

let db: Database;
let owner: string;
let listId: string;

const parsed: ParsedItemUpdate = {
  normalizedUrl: WB,
  store: "wildberries",
  title: "Диффузор для дома",
  description: "Морская соль",
  priceKopecks: 289100,
  imageKey: "items/x/photo.webp",
};

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db);
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
});

async function linkOnly(url = WB) {
  const result = await addItem(db, owner, listId, { title: "", sourceUrl: url, priceKopecks: null, note: null, isMustHave: false });
  if (!result.ok) throw new Error(result.reason);
  expect(result.needsParsing).toBe(true);
  return result.itemId;
}

const viewItem = async () => (await getOwnerWishlistView(db, owner, listId))?.items[0];

describe("getItemForParsing", () => {
  test("returns pending items with a link only", async () => {
    const id = await linkOnly();
    expect(await getItemForParsing(db, id)).toEqual({ id, sourceUrl: WB, hasImage: false });

    const manual = await addItem(db, owner, listId, { title: "Сертификат", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    if (!manual.ok) throw new Error("setup");
    expect(manual.needsParsing).toBe(false);
    expect(await getItemForParsing(db, manual.itemId)).toBeNull();

    await deleteItem(db, owner, id);
    expect(await getItemForParsing(db, id)).toBeNull();
    expect(await getItemForParsing(db, "not-a-uuid")).toBeNull();
  });
});

describe("applyParseResult", () => {
  test("fills an empty item and derives ok", async () => {
    const id = await linkOnly();
    expect(await applyParseResult(db, id, WB, parsed)).toBe(true);
    expect(await viewItem()).toMatchObject({ title: "Диффузор для дома", priceKopecks: 289100, imageKey: "items/x/photo.webp", parseStatus: "ok", store: "wildberries" });
    expect(await getItemForParsing(db, id)).toBeNull();
  });

  test("keeps what the owner typed while parsing was running", async () => {
    const id = await linkOnly();
    await db.update(items).set({ title: "Мой диффузор", priceKopecks: 250000 }).where(eq(items.id, id));
    await applyParseResult(db, id, WB, parsed);
    expect(await viewItem()).toMatchObject({ title: "Мой диффузор", priceKopecks: 250000, imageKey: "items/x/photo.webp", parseStatus: "ok" });
  });

  test("missing price is partial, missing title is failed", async () => {
    const partialId = await linkOnly();
    await applyParseResult(db, partialId, WB, { ...parsed, priceKopecks: null });
    expect(await viewItem()).toMatchObject({ parseStatus: "partial", priceKopecks: null });

    await deleteItem(db, owner, partialId);
    const failedId = await linkOnly();
    await applyParseResult(db, failedId, WB, { ...parsed, title: null, imageKey: null });
    expect(await viewItem()).toMatchObject({ parseStatus: "failed", title: "", priceKopecks: 289100 });
  });

  test("does nothing when the link changed, the item is gone or already parsed", async () => {
    const id = await linkOnly();
    expect(await applyParseResult(db, id, "https://goldapple.ru/other", parsed)).toBe(false);
    expect(await applyParseResult(db, id, WB, parsed)).toBe(true);
    expect(await applyParseResult(db, id, WB, { ...parsed, title: "Повтор" })).toBe(false);

    const deletedId = await linkOnly();
    await deleteItem(db, owner, deletedId);
    expect(await applyParseResult(db, deletedId, WB, parsed)).toBe(false);
  });
});

describe("updateItem and parsing", () => {
  const edit = { title: "Диффузор", sourceUrl: WB, priceKopecks: 289100, note: null, isMustHave: false };

  test("a new link sends the item back to parsing and drops the old photo", async () => {
    const id = await linkOnly();
    await applyParseResult(db, id, WB, parsed);
    const other = "https://goldapple.ru/19000180719-lip-mask";
    expect(await updateItem(db, owner, id, { ...edit, sourceUrl: other })).toEqual({ ok: true, needsParsing: true });
    expect(await viewItem()).toMatchObject({ parseStatus: "pending", imageKey: null, sourceUrl: other, store: "goldapple" });
  });

  test("editing other fields confirms the item as ok and keeps the photo", async () => {
    const id = await linkOnly();
    await applyParseResult(db, id, WB, { ...parsed, priceKopecks: null });
    expect(await updateItem(db, owner, id, edit)).toEqual({ ok: true, needsParsing: false });
    expect(await viewItem()).toMatchObject({ parseStatus: "ok", imageKey: "items/x/photo.webp", priceKopecks: 289100 });
  });

  test("removing the link drops the store photo", async () => {
    const id = await linkOnly();
    await applyParseResult(db, id, WB, parsed);
    expect(await updateItem(db, owner, id, { ...edit, sourceUrl: null })).toEqual({ ok: true, needsParsing: false });
    expect(await viewItem()).toMatchObject({ parseStatus: "ok", imageKey: null, store: null });
  });
});

describe("parse cache", () => {
  test("reads fresh entries, ignores stale ones, overwrites and prunes old rows", async () => {
    const now = new Date("2026-09-15T12:00:00Z");
    await writeParseCache(db, WB, { status: "ok", title: "Старое" }, now);
    await writeParseCache(db, WB, { status: "ok", title: "Новое" }, now);
    expect(await readParseCache(db, WB, new Date(now.getTime() + PARSE_CACHE_TTL_MS - 1))).toEqual({ status: "ok", title: "Новое" });
    expect(await readParseCache(db, WB, new Date(now.getTime() + PARSE_CACHE_TTL_MS + 1))).toBeNull();
    expect(await readParseCache(db, "https://nowhere.ru/", now)).toBeNull();

    await writeParseCache(db, "https://old.ru/", { status: "ok" }, new Date(now.getTime() - PARSE_CACHE_KEEP_MS - 1));
    expect(await pruneParseCache(db, now)).toBe(1);
    expect((await db.select().from(parseCache)).map((row) => row.normalizedUrl)).toEqual([WB]);
  });
});
```

Run: `pnpm vitest run packages/db/src/parsing.test.ts`
Expected: FAIL — `Cannot find module './parsing'`.

- [x] **Step 3: Изменения `items.ts`**

В `packages/db/src/items.ts`:

1. Импорт схемы заменить на `import { items, type ItemParseStatus, users, wishlists } from "./schema";`
2. В `OwnerItemView` после `reserved: boolean;` добавить:
```ts
  imageKey: string | null;
  parseStatus: ItemParseStatus;
```
3. `addItem` — тип результата и вставка:
```ts
export async function addItem(
  db: Database,
  ownerId: string,
  wishlistId: string,
  input: ItemInput,
): Promise<{ ok: true; itemId: string; needsParsing: boolean } | { ok: false; reason: "NOT_FOUND" | "LIMIT_REACHED" }> {
  const wishlist = await getOwnedWishlist(db, ownerId, wishlistId);
  if (!wishlist) return { ok: false, reason: "NOT_FOUND" };
  const [existing] = await db
    .select({ total: count() })
    .from(items)
    .where(and(eq(items.wishlistId, wishlistId), isNull(items.deletedAt)));
  if ((existing?.total ?? 0) >= MAX_ITEMS_PER_WISHLIST) return { ok: false, reason: "LIMIT_REACHED" };
  const needsParsing = input.sourceUrl !== null;
  const [row] = await db
    .insert(items)
    .values({ wishlistId, parseStatus: needsParsing ? "pending" : "ok", ...itemValues(input) })
    .returning({ id: items.id });
  return { ok: true, itemId: row!.id, needsParsing };
}
```
4. `updateItem` заменить целиком:
```ts
export async function updateItem(
  db: Database,
  ownerId: string,
  itemId: string,
  input: ItemInput,
): Promise<{ ok: true; needsParsing: boolean } | { ok: false }> {
  const id = await ownedItemId(db, ownerId, itemId);
  if (!id) return { ok: false };
  const [current] = await db.select({ sourceUrl: items.sourceUrl }).from(items).where(eq(items.id, id));
  const linkChanged = (current?.sourceUrl ?? null) !== input.sourceUrl;
  const needsParsing = linkChanged && input.sourceUrl !== null;
  // Фото и описание принадлежат старому товару; без ссылки фото из магазина тоже не нужно
  const reset = linkChanged ? { imageKey: null, description: null } : {};
  await db
    .update(items)
    .set({ ...itemValues(input), ...reset, parseStatus: needsParsing ? "pending" : "ok" })
    .where(eq(items.id, id));
  return { ok: true, needsParsing };
}
```
5. В `getOwnerWishlistView` в `select({...})` после `isMustHave: items.isMustHave,` добавить:
```ts
      imageKey: items.imageKey,
      parseStatus: items.parseStatus,
```

Существующие тесты `packages/db/src/items.test.ts` поправить под новые типы:
- в тесте `owner edits and soft-deletes; stranger cannot` заменить `expect(await updateItem(db, stranger, id, { ...headphones, title: "Взлом" })).toBe(false);` на `expect(await updateItem(db, stranger, id, { ...headphones, title: "Взлом" })).toEqual({ ok: false });`, строку с `"Наушники Sony"` — на `expect(await updateItem(db, owner, id, { ...headphones, title: "Наушники Sony", isMustHave: true, sourceUrl: null })).toEqual({ ok: true, needsParsing: false });`, последнюю `updateItem(...)).toBe(false)` — на `.toEqual({ ok: false })`;
- в тесте `malformed ids return false` — `expect(await updateItem(db, owner, "x", headphones)).toEqual({ ok: false });`;
- в тесте `adds a manual item and detects the store` в `objectContaining` добавить `parseStatus: "pending", imageKey: null` (у `headphones` есть ссылка).

- [x] **Step 4: `parsing.ts`**

`packages/db/src/parsing.ts`:
```ts
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { isUuid } from "./errors";
import { items, parseCache } from "./schema";
import type { Database } from "./types";

export const PARSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const PARSE_CACHE_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export type ItemForParsing = { id: string; sourceUrl: string; hasImage: boolean };

export type ParsedItemUpdate = {
  normalizedUrl: string;
  store: string;
  title: string | null;
  description: string | null;
  priceKopecks: number | null;
  imageKey: string | null;
};

export async function getItemForParsing(db: Database, itemId: string): Promise<ItemForParsing | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({ id: items.id, sourceUrl: items.sourceUrl, imageKey: items.imageKey })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.parseStatus, "pending"), isNull(items.deletedAt)));
  if (!row?.sourceUrl) return null;
  return { id: row.id, sourceUrl: row.sourceUrl, hasImage: row.imageKey !== null };
}

export async function applyParseResult(db: Database, itemId: string, sourceUrl: string, update: ParsedItemUpdate): Promise<boolean> {
  // В SET справа — значения строки до обновления: пустые поля заполняются, введённое владельцем остаётся
  const title = sql`case when ${items.title} = '' then ${update.title ?? ""} else ${items.title} end`;
  const price = sql`coalesce(${items.priceKopecks}, ${update.priceKopecks}::integer)`;
  const rows = await db
    .update(items)
    .set({
      normalizedUrl: update.normalizedUrl,
      store: update.store,
      title,
      description: sql`coalesce(${items.description}, ${update.description}::text)`,
      priceKopecks: price,
      imageKey: sql`coalesce(${items.imageKey}, ${update.imageKey}::text)`,
      parseStatus: sql`(case when (${title}) = '' then 'failed' when (${price}) is null then 'partial' else 'ok' end)::parse_status`,
    })
    .where(and(eq(items.id, itemId), eq(items.sourceUrl, sourceUrl), eq(items.parseStatus, "pending"), isNull(items.deletedAt)))
    .returning({ id: items.id });
  return rows.length > 0;
}

export async function readParseCache(db: Database, normalizedUrl: string, now = new Date()): Promise<unknown | null> {
  const [row] = await db
    .select({ result: parseCache.result, fetchedAt: parseCache.fetchedAt })
    .from(parseCache)
    .where(eq(parseCache.normalizedUrl, normalizedUrl));
  if (!row || now.getTime() - row.fetchedAt.getTime() > PARSE_CACHE_TTL_MS) return null;
  return row.result;
}

export async function writeParseCache(db: Database, normalizedUrl: string, result: unknown, now = new Date()): Promise<void> {
  await db
    .insert(parseCache)
    .values({ normalizedUrl, result, fetchedAt: now })
    .onConflictDoUpdate({ target: parseCache.normalizedUrl, set: { result, fetchedAt: now } });
}

export async function pruneParseCache(db: Database, now = new Date()): Promise<number> {
  const rows = await db
    .delete(parseCache)
    .where(lt(parseCache.fetchedAt, new Date(now.getTime() - PARSE_CACHE_KEEP_MS)))
    .returning({ url: parseCache.normalizedUrl });
  return rows.length;
}
```

В `packages/db/src/index.ts` добавить строку `export * from "./parsing";`.

Run: `pnpm vitest run packages/db`
Expected: PASS (все старые и новые тесты). Если Postgres ругается `could not determine data type of parameter` — у параметра в `sql\`...\`` не хватает явного приведения (`::integer`/`::text`), добавить его.

- [x] **Step 5: Публичный вид — фото и скрытие незаполненных карточек**

В `packages/db/src/public-view.ts`:
1. В `PublicItemView` после `isMustHave: boolean;` добавить `imageKey: string | null;`.
2. В `select({...})` запроса подарков после `isMustHave: items.isMustHave,` добавить `imageKey: items.imageKey,`.
3. Условие `where` запроса подарков заменить на:
```ts
    // Гостям не показываем скелетоны: подарок без названия, который ещё парсится
    .where(and(eq(items.wishlistId, header.id), isNull(items.deletedAt), sql`not (${items.parseStatus} = 'pending' and ${items.title} = '')`))
```
4. Добавить `sql` в импорт из `drizzle-orm`.

В `packages/db/src/public-view.test.ts` добавить в конец файла:
```ts
describe("pending items", () => {
  test("guests do not see link-only items that are still parsing", async () => {
    const pendingOwner = await createUserFixture(db, "Оля");
    const list = await createWishlist(db, pendingOwner, { title: "Скоро", occasion: "other", eventDate: null });
    if (!list.ok) throw new Error("setup");
    await addItem(db, pendingOwner, list.wishlist.id, { title: "", sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx", priceKopecks: null, note: null, isMustHave: false });
    await addItem(db, pendingOwner, list.wishlist.id, { title: "С названием", sourceUrl: "https://www.wildberries.ru/catalog/2/detail.aspx", priceKopecks: null, note: null, isMustHave: false });
    const view = await getPublicWishlist(db, list.wishlist.slug, { userId: null, guestToken: null });
    expect(view?.items.map((item) => item.title)).toEqual(["С названием"]);
    expect(view?.items[0]).toMatchObject({ imageKey: null });
  });
});
```

Run: `pnpm vitest run packages/db/src/public-view.test.ts`
Expected: PASS.

- [x] **Step 6: Web под новые типы**

В `apps/web/src/app/lists/[id]/actions.ts`, в `updateItemAction`, строку
```ts
  if (!(await updateItem(getDb(), user.id, itemId, parsed.value))) return errorState({}, LIMIT_MESSAGES.notFound, formValues(form));
```
заменить на
```ts
  const result = await updateItem(getDb(), user.id, itemId, parsed.value);
  if (!result.ok) return errorState({}, LIMIT_MESSAGES.notFound, formValues(form));
```
(постановка в очередь появится в Task 8).

- [x] **Step 7: Проверка и commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

```bash
git add packages/db apps/web
git commit -m "feat(db): parse cache, pending items and fill-only-empty parse results"
```

# Task 1: Переходы в магазин через `/go/:itemId`

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0003_*.sql` (генерирует drizzle-kit)
- Create: `packages/db/src/affiliate.ts`
- Test: `packages/db/src/affiliate.test.ts`
- Create: `apps/web/src/app/go/[itemId]/route.ts`, `apps/web/src/app/go/go-cookie.ts`
- Test: `apps/web/src/app/go/go-cookie.test.ts`
- Modify: `apps/web/src/components/item-card-model.ts`, `apps/web/src/components/item-card-model.test.ts`, `apps/web/src/app/[slug]/page.tsx`
- Add: `docs/ideas/council-report-2026-09-16.html`, `docs/ideas/council-transcript-2026-09-16.md`

**Interfaces:**
- Consumes: таблицы `items`, `wishlists`; `readViewer` (web).
- Produces:
  ```ts
  // @wishlist/db
  type GoTarget = { itemId: string; ownerId: string; sourceUrl: string; store: string | null };
  function getGoTarget(db: Database, itemId: string): Promise<GoTarget | null>;
  function recordAffiliateClick(db: Database, p: { itemId: string; store: string | null }): Promise<void>;
  // apps/web/src/app/go/go-cookie.ts
  const GO_COOKIE_MAX_AGE_SECONDS = 86400;
  function goCookieName(itemId: string): string;          // "wl_go_<первые 12 символов id без дефисов>"
  function isSafeRedirect(url: string): boolean;          // только http/https
  // item-card-model.ts
  type CardItem = { ...; linkHref?: string | null };      // если задан — ссылка «Открыть в магазине» ведёт сюда
  ```

- [ ] **Step 1: Ветка и отчёт совета**

```bash
git checkout master && git pull --ff-only && git checkout -b feat/growth
git add docs/ideas/council-report-2026-09-16.html docs/ideas/council-transcript-2026-09-16.md docs/superpowers/plans/2026-09-16-plan-6-growth
git commit -m "docs: monetization council report and plan 6 (growth before monetization)"
```
Expected: коммит на `feat/growth`.

- [ ] **Step 2: Таблица кликов**

В `packages/db/src/schema.ts` в конец:
```ts
// Статистика переходов гостей в магазин: только подарок, магазин и время
export const affiliateClicks = pgTable(
  "affiliate_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    store: text("store"),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("affiliate_clicks_item_idx").on(t.itemId), index("affiliate_clicks_time_idx").on(t.clickedAt)],
);
```

Таблицу `feature_interest` добавляет Task 6 своей миграцией `0004` — не объединять, чтобы задачи оставались независимыми.

Run: `pnpm --filter @wishlist/db db:generate`
Expected: `drizzle/0003_*.sql` с `CREATE TABLE "affiliate_clicks"`, внешним ключом на `items` и двумя индексами.

- [ ] **Step 3: Запросы — тест (падает)**

`packages/db/src/affiliate.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { getGoTarget, recordAffiliateClick } from "./affiliate";
import { addItem, deleteItem } from "./items";
import { affiliateClicks } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

const WB = "https://www.wildberries.ru/catalog/1/detail.aspx";

let db: Database;
let owner: string;
let listId: string;
let itemId: string;

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
  const added = await addItem(db, owner, listId, { title: "Наушники", sourceUrl: WB, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

test("go target is the item's own link, its store and owner", async () => {
  expect(await getGoTarget(db, itemId)).toEqual({ itemId, ownerId: owner, sourceUrl: WB, store: "wildberries" });
  expect(await getGoTarget(db, "not-a-uuid")).toBeNull();
});

test("deleted items and items without a link have nowhere to go", async () => {
  const manual = await addItem(db, owner, listId, { title: "Книга", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!manual.ok) throw new Error("setup");
  expect(await getGoTarget(db, manual.itemId)).toBeNull();
  await deleteItem(db, owner, itemId);
  expect(await getGoTarget(db, itemId)).toBeNull();
});

test("clicks are stored per item and store only", async () => {
  await recordAffiliateClick(db, { itemId, store: "wildberries" });
  const rows = await db.select().from(affiliateClicks);
  expect(rows).toHaveLength(1);
  expect(Object.keys(rows[0]!).sort()).toEqual(["clickedAt", "id", "itemId", "store"]);
});
```

Run: `pnpm vitest run packages/db/src/affiliate.test.ts`
Expected: FAIL — `Failed to resolve import "./affiliate"`.

- [ ] **Step 4: Запросы — реализация**

`packages/db/src/affiliate.ts`:
```ts
import { and, eq, isNull } from "drizzle-orm";
import { isUuid } from "./errors";
import { affiliateClicks, items, wishlists } from "./schema";
import type { Database } from "./types";

export type GoTarget = { itemId: string; ownerId: string; sourceUrl: string; store: string | null };

export async function getGoTarget(db: Database, itemId: string): Promise<GoTarget | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({ itemId: items.id, ownerId: wishlists.ownerId, sourceUrl: items.sourceUrl, store: items.store })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .where(and(eq(items.id, itemId), isNull(items.deletedAt)));
  return row?.sourceUrl ? { ...row, sourceUrl: row.sourceUrl } : null;
}

export async function recordAffiliateClick(db: Database, p: { itemId: string; store: string | null }): Promise<void> {
  await db.insert(affiliateClicks).values(p);
}
```

В `packages/db/src/index.ts` добавить `export * from "./affiliate";`.

Run: `pnpm vitest run packages/db`
Expected: PASS.

- [ ] **Step 5: Cookie и безопасный адрес — тест (падает)**

`apps/web/src/app/go/go-cookie.test.ts`:
```ts
import { expect, test } from "vitest";
import { GO_COOKIE_MAX_AGE_SECONDS, goCookieName, isSafeRedirect } from "./go-cookie";

test("one short cookie name per item", () => {
  expect(goCookieName("3c5e5e81-358d-4c3d-b4ed-100bac8fea49")).toBe("wl_go_3c5e5e81358d");
  expect(GO_COOKIE_MAX_AGE_SECONDS).toBe(86400);
});

test("only web links are followed", () => {
  expect(isSafeRedirect("https://www.wildberries.ru/catalog/1/detail.aspx")).toBe(true);
  expect(isSafeRedirect("http://shop.ru/p/1")).toBe(true);
  expect(isSafeRedirect("javascript:alert(1)")).toBe(false);
  expect(isSafeRedirect("data:text/html,hi")).toBe(false);
  expect(isSafeRedirect("не ссылка")).toBe(false);
});
```

Run: `pnpm vitest run apps/web/src/app/go`
Expected: FAIL — `Failed to resolve import "./go-cookie"`.

- [ ] **Step 6: Cookie и маршрут — реализация**

`apps/web/src/app/go/go-cookie.ts`:
```ts
export const GO_COOKIE_MAX_AGE_SECONDS = 86400;

// Один переход на подарок от одного браузера в сутки; на сервере ничего о госте не храним
export function goCookieName(itemId: string): string {
  return `wl_go_${itemId.replace(/-/g, "").slice(0, 12)}`;
}

export function isSafeRedirect(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
```

`apps/web/src/app/go/[itemId]/route.ts`:
```ts
import { getGoTarget, recordAffiliateClick } from "@wishlist/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { readViewer } from "@/server/viewer";
import { GO_COOKIE_MAX_AGE_SECONDS, goCookieName, isSafeRedirect } from "../go-cookie";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const target = await getGoTarget(getDb(), itemId);
  if (!target || !isSafeRedirect(target.sourceUrl)) return new NextResponse("Подарок не найден", { status: 404 });

  const response = NextResponse.redirect(target.sourceUrl, 302);
  const { viewer } = await readViewer();
  const cookie = goCookieName(target.itemId);
  // Клики владельца по своему списку и повторные клики за сутки не считаем
  if (viewer.userId === target.ownerId || request.cookies.has(cookie)) return response;
  try {
    await recordAffiliateClick(getDb(), { itemId: target.itemId, store: target.store });
  } catch (error) {
    // Статистика не должна мешать гостю попасть в магазин
    console.error("go click not recorded", { itemId: target.itemId, error: String(error) });
  }
  response.cookies.set(cookie, "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/go", maxAge: GO_COOKIE_MAX_AGE_SECONDS });
  return response;
}
```

Run: `pnpm vitest run apps/web/src/app/go`
Expected: PASS (2 теста).

- [ ] **Step 7: Ссылка гостя через `/go`**

`apps/web/src/components/item-card-model.ts`: в `CardItem` добавить поле
```ts
  // Публичная страница передаёт /go/<id>, чтобы переход засчитался; у владельца — прямая ссылка
  linkHref?: string | null;
```
и в `toCardModel` заменить `href: item.sourceUrl,` на
```ts
    href: item.sourceUrl ? (item.linkHref ?? item.sourceUrl) : null,
```

В `apps/web/src/components/item-card-model.test.ts` в конец `describe("toCardModel", ...)` добавить:
```ts
  test("public cards can route the store link through /go", () => {
    const base = { title: "Наушники", sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx", priceKopecks: null, note: null, isMustHave: false };
    expect(toCardModel({ ...base, linkHref: "/go/i1" }).href).toBe("/go/i1");
    expect(toCardModel({ ...base, sourceUrl: null, linkHref: "/go/i1" }).href).toBeNull();
  });
```

`apps/web/src/app/[slug]/page.tsx`: в `<ItemCard ... item={{ ...item, imageUrl: imageUrlFor(item.imageKey, publicBaseUrl) }}` добавить `linkHref`:
```tsx
item={{ ...item, imageUrl: imageUrlFor(item.imageKey, publicBaseUrl), linkHref: isOwner ? null : `/go/${item.id}` }}
```

- [ ] **Step 8: Проверка**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS; в выводе сборки маршрут `ƒ /go/[itemId]`.

Локально (`pnpm dev:db`, `pnpm dev:web`, подарок со ссылкой в списке, публичная страница в окне без входа): «Открыть в магазине ↗» ведёт на `/go/<id>` и открывает магазин; повторный клик в течение суток не добавляет строку:
```bash
node -e 'import("postgres").then(async ({default: pg}) => { const sql = pg("postgres://postgres:postgres@127.0.0.1:5433/postgres"); console.log(await sql`select item_id, store, clicked_at from affiliate_clicks order by clicked_at desc limit 3`); await sql.end(); })'
```
(запускать из `packages/db`, где установлен `postgres`).

- [ ] **Step 9: Commit**

```bash
git add packages/db apps/web
git commit -m "feat: count guest store visits through /go/:itemId"
```

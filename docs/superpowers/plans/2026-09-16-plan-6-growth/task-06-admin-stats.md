# Task 6: Цифры для решений — `/stats` в боте

**Files:**
- Create: `packages/db/src/stats.ts`
- Test: `packages/db/src/stats.test.ts`
- Modify: `packages/db/src/index.ts`
- Create: `apps/worker/src/bot/stats.ts`
- Test: `apps/worker/src/bot/stats.test.ts`
- Modify: `apps/worker/src/bot/create-bot.ts`

**Interfaces:**
- Consumes: таблицы `users`, `wishlists`, `items`, `reservations`, `affiliate_clicks` (Task 1), `countInterest`, `FEATURE_THEMES` (Task 5); `TelegramConfig.adminId` (план 4).
- Produces:
  ```ts
  // @wishlist/db
  type AdminStats = {
    users: { total: number; new: number };
    wishlists: { total: number; new: number; withThreeItems: number };
    items: { new: number };
    reservations: { new: number };
    storeVisits: { new: number; byStore: { store: string; count: number }[] };
    themeInterest: number;
  };
  function adminStats(db: Database, since: Date): Promise<AdminStats>;
  // apps/worker/src/bot/stats.ts
  const STATS_WINDOW_DAYS = 7;
  function statsText(stats: AdminStats): string;
  ```

Метрики из спеки (раздел 9), которые уже можно посчитать: пользователи, списки (и сколько из них с 3+ подарками), новые подарки, брони, переходы в магазин по магазинам, интерес к оформлению. «Поделились списком» не считается — такого события в данных нет. Команда отвечает только `ADMIN_TELEGRAM_ID`; остальным бот молчит, как будто команды нет.

- [ ] **Step 1: Тест агрегатов (падает)**

`packages/db/src/stats.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { beforeEach, expect, test } from "vitest";
import { recordAffiliateClick } from "./affiliate";
import { FEATURE_THEMES, registerInterest } from "./interest";
import { addItem, deleteItem } from "./items";
import { reservations, users, wishlists } from "./schema";
import { adminStats } from "./stats";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

// Всё, что создаёт тест, получает created_at = now(); «старое» задаётся явным update в прошлое
const SINCE = new Date(Date.now() - 60 * 60_000);
const BEFORE = new Date(Date.now() - 30 * 86_400_000);

let db: Database;

const add = async (owner: string, listId: string, title: string, sourceUrl: string | null = null) => {
  const added = await addItem(db, owner, listId, { title, sourceUrl, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  return added.itemId;
};

beforeEach(async () => {
  db = await createTestDb();
});

test("counts totals and what happened since the given moment", async () => {
  const old = await createUserFixture(db, "Старый");
  await db.update(users).set({ createdAt: BEFORE }).where(eq(users.id, old));
  const masha = await createUserFixture(db, "Маша");

  const oldList = await createWishlist(db, old, { title: "Старый список", occasion: "other", eventDate: null });
  const list = await createWishlist(db, masha, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!oldList.ok || !list.ok) throw new Error("setup");
  await db.update(wishlists).set({ createdAt: BEFORE }).where(eq(wishlists.id, oldList.wishlist.id));

  const wb = await add(masha, list.wishlist.id, "Наушники", "https://www.wildberries.ru/catalog/1/detail.aspx");
  const ga = await add(masha, list.wishlist.id, "Духи", "https://goldapple.ru/1-x");
  await add(masha, list.wishlist.id, "Книга");
  const deleted = await add(masha, list.wishlist.id, "Удалённый");
  await deleteItem(db, masha, deleted);

  await db.insert(reservations).values({ itemId: wb, guestToken: "t", guestName: "Оля", cancelToken: "c1" });
  await recordAffiliateClick(db, { itemId: wb, store: "wildberries" });
  await recordAffiliateClick(db, { itemId: wb, store: "wildberries" });
  await recordAffiliateClick(db, { itemId: ga, store: "goldapple" });
  await registerInterest(db, masha, FEATURE_THEMES);

  expect(await adminStats(db, SINCE)).toEqual({
    users: { total: 2, new: 1 },
    wishlists: { total: 2, new: 1, withThreeItems: 1 },
    items: { new: 3 },
    reservations: { new: 1 },
    storeVisits: {
      new: 3,
      byStore: [
        { store: "wildberries", count: 2 },
        { store: "goldapple", count: 1 },
      ],
    },
    themeInterest: 1,
  });
});
```

Run: `pnpm vitest run packages/db/src/stats.test.ts`
Expected: FAIL — `Failed to resolve import "./stats"`.

- [ ] **Step 2: Агрегаты — реализация**

`packages/db/src/stats.ts`:
```ts
import { and, count, desc, gte, isNull, sql } from "drizzle-orm";
import { countInterest, FEATURE_THEMES } from "./interest";
import { affiliateClicks, items, reservations, users, wishlists } from "./schema";
import type { Database } from "./types";

export type AdminStats = {
  users: { total: number; new: number };
  wishlists: { total: number; new: number; withThreeItems: number };
  items: { new: number };
  reservations: { new: number };
  storeVisits: { new: number; byStore: { store: string; count: number }[] };
  themeInterest: number;
};

const MIN_ITEMS_FOR_ACTIVE_LIST = 3;

export async function adminStats(db: Database, since: Date): Promise<AdminStats> {
  const [usersTotal] = await db.select({ n: count() }).from(users);
  const [usersNew] = await db.select({ n: count() }).from(users).where(gte(users.createdAt, since));
  const [listsTotal] = await db.select({ n: count() }).from(wishlists);
  const [listsNew] = await db.select({ n: count() }).from(wishlists).where(gte(wishlists.createdAt, since));
  // Доля списков с 3+ подарками — метрика из спеки: список, в который правда что-то добавили
  const [active] = await db.select({ n: sql<number>`count(*)::int` }).from(
    db
      .select({ wishlistId: items.wishlistId })
      .from(items)
      .where(isNull(items.deletedAt))
      .groupBy(items.wishlistId)
      .having(sql`count(*) >= ${MIN_ITEMS_FOR_ACTIVE_LIST}`)
      .as("active_lists"),
  );
  const [itemsNew] = await db.select({ n: count() }).from(items).where(and(gte(items.createdAt, since), isNull(items.deletedAt)));
  const [reservationsNew] = await db.select({ n: count() }).from(reservations).where(gte(reservations.createdAt, since));
  const byStore = await db
    .select({ store: sql<string>`coalesce(${affiliateClicks.store}, 'other')`, count: sql<number>`count(*)::int` })
    .from(affiliateClicks)
    .where(gte(affiliateClicks.clickedAt, since))
    .groupBy(sql`coalesce(${affiliateClicks.store}, 'other')`)
    .orderBy(desc(sql`count(*)`));

  return {
    users: { total: usersTotal?.n ?? 0, new: usersNew?.n ?? 0 },
    wishlists: { total: listsTotal?.n ?? 0, new: listsNew?.n ?? 0, withThreeItems: active?.n ?? 0 },
    items: { new: itemsNew?.n ?? 0 },
    reservations: { new: reservationsNew?.n ?? 0 },
    storeVisits: { new: byStore.reduce((sum, row) => sum + row.count, 0), byStore },
    themeInterest: await countInterest(db, FEATURE_THEMES),
  };
}
```

В `packages/db/src/index.ts` добавить `export * from "./stats";`.

Run: `pnpm vitest run packages/db`
Expected: PASS.

- [ ] **Step 3: Текст — тест (падает)**

`apps/worker/src/bot/stats.test.ts`:
```ts
import type { AdminStats } from "@wishlist/db";
import { expect, test } from "vitest";
import { STATS_WINDOW_DAYS, statsText } from "./stats";

const stats: AdminStats = {
  users: { total: 40, new: 12 },
  wishlists: { total: 25, new: 9, withThreeItems: 10 },
  items: { new: 130 },
  reservations: { new: 17 },
  storeVisits: { new: 21, byStore: [{ store: "wildberries", count: 15 }, { store: "ozon", count: 6 }] },
  themeInterest: 4,
};

test("a compact report for the admin", () => {
  expect(STATS_WINDOW_DAYS).toBe(7);
  expect(statsText(stats)).toBe(
    [
      "📊 За 7 дней (всего)",
      "Пользователи: +12 (40)",
      "Списки: +9 (25), с 3+ подарками: 10",
      "Подарки: +130",
      "Брони: +17",
      "Переходы в магазин: +21 — wildberries 15, ozon 6",
      "Хотят оформление: 4",
    ].join("\n"),
  );
});

test("no visits yet", () => {
  expect(statsText({ ...stats, storeVisits: { new: 0, byStore: [] } })).toContain("Переходы в магазин: +0");
});
```

Run: `pnpm vitest run apps/worker/src/bot/stats.test.ts`
Expected: FAIL — `Failed to resolve import "./stats"`.

- [ ] **Step 4: Текст и команда — реализация**

`apps/worker/src/bot/stats.ts`:
```ts
import type { AdminStats } from "@wishlist/db";

export const STATS_WINDOW_DAYS = 7;

export function statsText(stats: AdminStats): string {
  const visits = stats.storeVisits.byStore.map((row) => `${row.store} ${row.count}`).join(", ");
  return [
    `📊 За ${STATS_WINDOW_DAYS} дней (всего)`,
    `Пользователи: +${stats.users.new} (${stats.users.total})`,
    `Списки: +${stats.wishlists.new} (${stats.wishlists.total}), с 3+ подарками: ${stats.wishlists.withThreeItems}`,
    `Подарки: +${stats.items.new}`,
    `Брони: +${stats.reservations.new}`,
    `Переходы в магазин: +${stats.storeVisits.new}${visits ? ` — ${visits}` : ""}`,
    `Хотят оформление: ${stats.themeInterest}`,
  ].join("\n");
}
```

`apps/worker/src/bot/create-bot.ts`: импорты
```ts
import { adminStats } from "@wishlist/db";
import { STATS_WINDOW_DAYS, statsText } from "./stats";
```
и после команды `myid`:
```ts
  // Только администратору; остальным бот не показывает, что команда существует
  bot.command("stats", async (ctx) => {
    if (!ctx.from || deps.config.adminId === null || ctx.from.id !== deps.config.adminId) return;
    const since = new Date(Date.now() - STATS_WINDOW_DAYS * 86_400_000);
    await ctx.reply(statsText(await adminStats(deps.db, since)));
  });
```

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/worker build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db apps/worker
git commit -m "feat: weekly product numbers for the admin via /stats"
```

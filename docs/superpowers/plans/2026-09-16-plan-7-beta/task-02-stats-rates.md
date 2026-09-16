# Task 2: Ключевые доли в `/stats`

**Files:**
- Modify: `packages/db/src/stats.ts`, `packages/db/src/stats.test.ts`
- Modify: `apps/worker/src/bot/stats.ts`, `apps/worker/src/bot/stats.test.ts`

**Interfaces:**
- Consumes: `adminStats`, `AdminStats`, `statsText` (план 6).
- Produces:
  ```ts
  // AdminStats.wishlists получает поле
  withReservations: number;   // списки, где есть хотя бы одна активная бронь на неудалённом подарке
  function percent(part: number, total: number): string; // "40%", при total = 0 — "—"
  ```

Спека (раздел 9) называет ключевыми доли, а не абсолютные числа: доля списков с 3+ подарками (человек правда собрал список) и доля списков с бронями (ссылкой поделились, и гости пришли). На бете это главные сигналы.

- [ ] **Step 1: Тест агрегата (падает)**

В `packages/db/src/stats.test.ts` в ожидании `wishlists` заменить
```ts
    wishlists: { total: 2, new: 1, withThreeItems: 1 },
```
на
```ts
    wishlists: { total: 2, new: 1, withThreeItems: 1, withReservations: 1 },
```

И добавить тест в конец файла:
```ts
test("cancelled reservations and deleted items do not make a list 'with reservations'", async () => {
  const masha = await createUserFixture(db, "Маша");
  const list = await createWishlist(db, masha, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  const a = await add(masha, list.wishlist.id, "Свеча");
  const b = await add(masha, list.wishlist.id, "Шарф");
  await db.insert(reservations).values({ itemId: a, guestToken: "t1", guestName: "Оля", cancelToken: "c-a", status: "cancelled" });
  await db.insert(reservations).values({ itemId: b, guestToken: "t2", guestName: "Петя", cancelToken: "c-b" });
  await deleteItem(db, masha, b);
  expect((await adminStats(db, SINCE)).wishlists.withReservations).toBe(0);
});
```

Run: `pnpm vitest run packages/db/src/stats.test.ts`
Expected: FAIL — нет поля `withReservations`.

- [ ] **Step 2: Агрегат — реализация**

`packages/db/src/stats.ts`:

в типе `AdminStats` заменить строку `wishlists` на
```ts
  wishlists: { total: number; new: number; withThreeItems: number; withReservations: number };
```

перед `const [itemsNew]` добавить
```ts
  const [reserved] = await db
    .select({ n: sql<number>`count(distinct ${items.wishlistId})::int` })
    .from(reservations)
    .innerJoin(items, and(eq(items.id, reservations.itemId), isNull(items.deletedAt)))
    .where(eq(reservations.status, "active"));
```

в возвращаемом объекте заменить `wishlists: {...}` на
```ts
    wishlists: { total: listsTotal?.n ?? 0, new: listsNew?.n ?? 0, withThreeItems: active?.n ?? 0, withReservations: reserved?.n ?? 0 },
```

и добавить `eq` в импорт из `drizzle-orm`.

Run: `pnpm vitest run packages/db`
Expected: PASS.

- [ ] **Step 3: Текст — тест (падает)**

`apps/worker/src/bot/stats.test.ts`:
- в объекте `stats` заменить `wishlists: { total: 25, new: 9, withThreeItems: 10 }` на `wishlists: { total: 25, new: 9, withThreeItems: 10, withReservations: 5 }`;
- в ожидаемом тексте заменить строку `"Списки: +9 (25), с 3+ подарками: 10",` на `"Списки: +9 (25), с 3+ подарками: 10 (40%), с бронями: 5 (20%)",`;
- добавить тест:
```ts
test("percentages survive an empty database", () => {
  expect(percent(3, 0)).toBe("—");
  expect(percent(1, 3)).toBe("33%");
});
```
и `percent` в импорт из `./stats`.

Run: `pnpm vitest run apps/worker/src/bot/stats.test.ts`
Expected: FAIL.

- [ ] **Step 4: Текст — реализация**

`apps/worker/src/bot/stats.ts`:
```ts
export function percent(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}
```
и в `statsText` заменить строку списков на
```ts
    `Списки: +${stats.wishlists.new} (${stats.wishlists.total}), с 3+ подарками: ${stats.wishlists.withThreeItems} (${percent(stats.wishlists.withThreeItems, stats.wishlists.total)}), с бронями: ${stats.wishlists.withReservations} (${percent(stats.wishlists.withReservations, stats.wishlists.total)})`,
```

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db apps/worker
git commit -m "feat: share of lists with 3+ gifts and with reservations in /stats"
```

# Task 5: «Оформление — скоро» с кнопкой «Хочу»

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0004_*.sql` (генерирует drizzle-kit)
- Create: `packages/db/src/interest.ts`
- Test: `packages/db/src/interest.test.ts`
- Create: `apps/web/src/app/lists/[id]/ThemeInterest.tsx`
- Modify: `apps/web/src/app/lists/[id]/actions.ts`, `apps/web/src/app/lists/[id]/page.tsx`

**Interfaces:**
- Consumes: `requireUser`, `editLimiter` (web).
- Produces:
  ```ts
  // @wishlist/db
  const FEATURE_THEMES = "themes";
  type Feature = typeof FEATURE_THEMES;
  function registerInterest(db: Database, userId: string, feature: Feature): Promise<"added" | "already">;
  function hasInterest(db: Database, userId: string, feature: Feature): Promise<boolean>;
  function countInterest(db: Database, feature: Feature): Promise<number>;
  // web
  function themeInterestAction(wishlistId: string): Promise<void>;
  ```

Проверка спроса без оплаты: владелец видит, что другие оформления появятся, и может нажать «Хочу». Без цены и без даты — это не обещание, а сбор интереса. Показывается и на сайте, и в Mini App: цен и ссылок на оплату нет, правила Telegram не нарушаются.

- [ ] **Step 1: Таблица**

В `packages/db/src/schema.ts` в конец:
```ts
// Интерес к будущим функциям: один голос пользователя на функцию
export const featureInterest = pgTable(
  "feature_interest",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("feature_interest_user_feature_uq").on(t.userId, t.feature)],
);
```

Run: `pnpm --filter @wishlist/db db:generate`
Expected: `drizzle/0004_*.sql` с `CREATE TABLE "feature_interest"` и уникальным индексом.

- [ ] **Step 2: Тест (падает)**

`packages/db/src/interest.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { countInterest, FEATURE_THEMES, hasInterest, registerInterest } from "./interest";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

test("one vote per user, counted across users", async () => {
  const masha = await createUserFixture(db, "Маша");
  const olya = await createUserFixture(db, "Оля");
  expect(await hasInterest(db, masha, FEATURE_THEMES)).toBe(false);
  expect(await registerInterest(db, masha, FEATURE_THEMES)).toBe("added");
  expect(await registerInterest(db, masha, FEATURE_THEMES)).toBe("already");
  expect(await registerInterest(db, olya, FEATURE_THEMES)).toBe("added");
  expect(await hasInterest(db, masha, FEATURE_THEMES)).toBe(true);
  expect(await countInterest(db, FEATURE_THEMES)).toBe(2);
});
```

Run: `pnpm vitest run packages/db/src/interest.test.ts`
Expected: FAIL — `Failed to resolve import "./interest"`.

- [ ] **Step 3: Реализация**

`packages/db/src/interest.ts`:
```ts
import { and, count, eq } from "drizzle-orm";
import { featureInterest } from "./schema";
import type { Database } from "./types";

export const FEATURE_THEMES = "themes";
export type Feature = typeof FEATURE_THEMES;

export async function registerInterest(db: Database, userId: string, feature: Feature): Promise<"added" | "already"> {
  const inserted = await db.insert(featureInterest).values({ userId, feature }).onConflictDoNothing().returning({ userId: featureInterest.userId });
  return inserted.length > 0 ? "added" : "already";
}

export async function hasInterest(db: Database, userId: string, feature: Feature): Promise<boolean> {
  const [row] = await db
    .select({ userId: featureInterest.userId })
    .from(featureInterest)
    .where(and(eq(featureInterest.userId, userId), eq(featureInterest.feature, feature)))
    .limit(1);
  return row !== undefined;
}

export async function countInterest(db: Database, feature: Feature): Promise<number> {
  const [row] = await db.select({ total: count() }).from(featureInterest).where(eq(featureInterest.feature, feature));
  return row?.total ?? 0;
}
```

В `packages/db/src/index.ts` добавить `export * from "./interest";`.

Run: `pnpm vitest run packages/db`
Expected: PASS.

- [ ] **Step 4: Действие и блок в настройках**

`apps/web/src/app/lists/[id]/actions.ts`: в импорт из `@wishlist/db` добавить `FEATURE_THEMES, registerInterest`, в конец файла:
```ts
export async function themeInterestAction(wishlistId: string): Promise<void> {
  const { user, allowed } = await authorizedOwner();
  if (!allowed) return;
  await registerInterest(getDb(), user.id, FEATURE_THEMES);
  revalidatePath(`/lists/${wishlistId}`);
}
```

`apps/web/src/app/lists/[id]/ThemeInterest.tsx`:
```tsx
import { themeInterestAction } from "./actions";

export function ThemeInterest({ wishlistId, voted }: { wishlistId: string; voted: boolean }) {
  return (
    <section className="panel stack" aria-label="Оформление списка" style={{ marginTop: 16 }}>
      <div className="row row--between">
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Оформление</h2>
        <span className="muted">«Журнал»</span>
      </div>
      <p className="muted" style={{ margin: 0 }}>Готовим другие варианты: строгий «Минимал» и нежную «Романтику».</p>
      {voted ? (
        <p className="muted" style={{ margin: 0 }}>Спасибо! Учли, что вам это интересно.</p>
      ) : (
        <form action={themeInterestAction.bind(null, wishlistId)}>
          <button type="submit" className="button button--ghost button--small">Хочу другое оформление</button>
        </form>
      )}
    </section>
  );
}
```

`apps/web/src/app/lists/[id]/page.tsx`: импорт `hasInterest, FEATURE_THEMES` из `@wishlist/db` и `ThemeInterest` из `./ThemeInterest`; рядом с загрузкой данных списка добавить
```ts
  const votedForThemes = await hasInterest(getDb(), user.id, FEATURE_THEMES);
```
и сразу перед `<ListSettings ... />` вставить
```tsx
      <ThemeInterest wishlistId={view.wishlist.id} voted={votedForThemes} />
```
(имена `user`, `view` — как на странице; если переменная данных списка называется иначе, использовать её).

- [ ] **Step 5: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS.

Локально: на странице своего списка блок «Оформление» → «Хочу другое оформление» → текст «Спасибо! Учли…», после перезагрузки остаётся.

```bash
git add packages/db apps/web
git commit -m "feat: collect interest in list themes without payments"
```

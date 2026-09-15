# Task 5: Web — задачи `notify`, «Напомнить в Telegram», переход из бота в нужный список

**Files:**
- Modify: `apps/web/src/server/queue.ts`
- Modify: `apps/web/src/app/[slug]/actions.ts`, `apps/web/src/app/[slug]/page.tsx`
- Create: `apps/web/src/app/[slug]/remind-link.ts`
- Test: `apps/web/src/app/[slug]/remind-link.test.ts`
- Modify: `apps/web/src/app/lists/[id]/actions.ts`
- Modify: `packages/db/src/public-view.ts`
- Test: `packages/db/src/public-view.test.ts` (новый тест)
- Create: `apps/web/src/app/tg/next-path.ts`
- Test: `apps/web/src/app/tg/next-path.test.ts`
- Modify: `apps/web/src/app/tg/TelegramAutoLogin.tsx`

**Interfaces:**
- Consumes: `NotifyJob`, `NOTIFY_JOB_OPTIONS`, `QUEUES.notify`, `signReminderPayload` (Tasks 1–2); `getEnv().SESSION_SECRET`, `getEnv().TELEGRAM_BOT_USERNAME` (план 1).
- Produces:
  ```ts
  // apps/web/src/server/queue.ts
  function enqueueNotify(job: NotifyJob): Promise<void>; // никогда не бросает
  // @wishlist/db PublicItemView
  remindReservationId: string | null; // id брони — только гостю, который её поставил, и только если бронь без пользователя
  // apps/web/src/app/[slug]/remind-link.ts
  function reminderBotLink(botUsername: string, reservationId: string, secret: string): string;
  // apps/web/src/app/tg/next-path.ts
  const DEFAULT_NEXT_PATH = "/lists";
  function safeNextPath(raw: string | null): string;
  ```

- [ ] **Step 1: Очередь уведомлений**

`apps/web/src/server/queue.ts` — заменить функцию `enqueueParse` и добавить `enqueueNotify` (функция `queue()` без изменений):
```ts
import { NOTIFY_JOB_OPTIONS, type NotifyJob, PARSE_JOB_OPTIONS, type ParseItemJob, QUEUES } from "@wishlist/core";
```
```ts
export async function enqueueParse(itemId: string): Promise<void> {
  try {
    const boss = await queue();
    const job: ParseItemJob = { itemId };
    await boss.send(QUEUES.parseItem, job, PARSE_JOB_OPTIONS);
  } catch (error) {
    // Подарок уже сохранён; без воркера он останется pending, и страница предложит заполнить его вручную
    console.error("enqueue parse failed", { itemId, error: String(error) });
  }
}

export async function enqueueNotify(job: NotifyJob): Promise<void> {
  try {
    const boss = await queue();
    await boss.send(QUEUES.notify, job, NOTIFY_JOB_OPTIONS);
  } catch (error) {
    // Бронь или удаление уже сохранены; потерянное уведомление не должно ломать действие пользователя
    console.error("enqueue notify failed", { kind: job.kind, itemId: job.itemId, error: String(error) });
  }
}
```

- [ ] **Step 2: Ставим уведомления из действий**

`apps/web/src/app/[slug]/actions.ts`: импорт
```ts
import { enqueueNotify } from "@/server/queue";
```
и в `reserveAction` заменить
```ts
  return successState("Готово! Подарок за вами");
```
на
```ts
  await enqueueNotify({ kind: "reservation_created", itemId });
  return successState("Готово! Подарок за вами");
```

`apps/web/src/app/lists/[id]/actions.ts`: импорт `enqueueNotify` рядом с `enqueueParse`:
```ts
import { enqueueNotify, enqueueParse } from "@/server/queue";
```
и `deleteItemAction` заменить целиком:
```ts
export async function deleteItemAction(wishlistId: string, itemId: string): Promise<void> {
  const { user } = await authorizedOwner();
  // Воркер сам проверит, была ли на подарке бронь: без брони уведомлять некого
  if (await deleteItem(getDb(), user.id, itemId)) await enqueueNotify({ kind: "item_deleted", itemId });
  revalidatePath(`/lists/${wishlistId}`);
}
```

- [ ] **Step 3: Id брони для гостя — тест (падает)**

В `packages/db/src/public-view.test.ts` в `describe("getPublicWishlist", ...)` после теста `"matches a logged-in guest by user id"` добавить:
```ts
  test("only the site guest who reserved gets the reservation id for Telegram reminders", async () => {
    const [row] = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.itemId, reservedId));
    const remindOf = (view: Awaited<ReturnType<typeof getPublicWishlist>>, id: string) => view?.items.find((i) => i.id === id)?.remindReservationId;
    expect(remindOf(await getPublicWishlist(db, slug, anna), reservedId)).toBe(row!.id);
    expect(remindOf(await getPublicWishlist(db, slug, petya), reservedId)).toBeNull();
    expect(remindOf(await getPublicWishlist(db, slug, { userId: owner, guestToken: null }), reservedId)).toBeNull();
    expect(remindOf(await getPublicWishlist(db, slug, anna), freeId)).toBeNull();

    await db.insert(reservations).values({ itemId: freeId, guestName: "Оля", guestUserId: guestUser, cancelToken: "c3" });
    expect(remindOf(await getPublicWishlist(db, slug, { userId: guestUser, guestToken: null }), freeId)).toBeNull();
  });
```

Run: `pnpm vitest run packages/db/src/public-view.test.ts`
Expected: FAIL — `remindReservationId` равен `undefined`.

- [ ] **Step 4: Id брони для гостя — реализация**

В `packages/db/src/public-view.ts`:

в `PublicItemView` после `status: PublicItemStatus;` добавить:
```ts
  // Гостю с сайта — чтобы подключить напоминания в Telegram; остальным всегда null
  remindReservationId: string | null;
```

в `publicItems = rows.map(...)` заменить `return { ...item, status };` на:
```ts
    const remindReservationId = status === "reserved_by_me" && reservationGuestUserId === null ? reservationId : null;
    return { ...item, status, remindReservationId };
```

Run: `pnpm vitest run packages/db`
Expected: PASS, включая `PRIVACY: never exposes guest names or tokens` (id брони — не токен и не имя).

- [ ] **Step 5: Ссылка на бота — тест (падает)**

`apps/web/src/app/[slug]/remind-link.test.ts`:
```ts
import { verifyReminderPayload } from "@wishlist/core";
import { expect, test } from "vitest";
import { reminderBotLink } from "./remind-link";

test("links to the bot with a signed start parameter", () => {
  const secret = "s".repeat(32);
  const id = "3c5e5e81-358d-4c3d-b4ed-100bac8fea49";
  const link = new URL(reminderBotLink("my_wish_list1_bot", id, secret));
  expect(`${link.origin}${link.pathname}`).toBe("https://t.me/my_wish_list1_bot");
  expect(verifyReminderPayload(link.searchParams.get("start") ?? "", secret)).toBe(id);
});
```

Run: `pnpm vitest run "apps/web/src/app/\[slug\]/remind-link.test.ts"`
Expected: FAIL — `Failed to resolve import "./remind-link"`.

- [ ] **Step 6: Ссылка на бота — реализация и кнопка**

`apps/web/src/app/[slug]/remind-link.ts`:
```ts
import { signReminderPayload } from "@wishlist/core";

export function reminderBotLink(botUsername: string, reservationId: string, secret: string): string {
  return `https://t.me/${botUsername}?start=${signReminderPayload(reservationId, secret)}`;
}
```

`apps/web/src/app/[slug]/page.tsx`: импорт
```ts
import { reminderBotLink } from "./remind-link";
```
после `const defaultName = ...` добавить:
```ts
  const env = getEnv();
```
и заменить строку
```tsx
              {!isOwner && item.status === "reserved_by_me" && <CancelReservationButton slug={wishlist.slug} itemId={item.id} />}
```
на
```tsx
              {!isOwner && item.status === "reserved_by_me" && (
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <CancelReservationButton slug={wishlist.slug} itemId={item.id} />
                  {item.remindReservationId && (
                    <a
                      className="link-button"
                      href={reminderBotLink(env.TELEGRAM_BOT_USERNAME, item.remindReservationId, env.SESSION_SECRET)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Напомнить в Telegram
                    </a>
                  )}
                </div>
              )}
```

Run: `pnpm vitest run apps/web`
Expected: PASS.

- [ ] **Step 7: `/tg?next=` — тест (падает)**

`apps/web/src/app/tg/next-path.test.ts`:
```ts
import { expect, test } from "vitest";
import { DEFAULT_NEXT_PATH, safeNextPath } from "./next-path";

test("keeps in-app paths from the bot", () => {
  expect(safeNextPath("/lists/3c5e5e81-358d-4c3d-b4ed-100bac8fea49")).toBe("/lists/3c5e5e81-358d-4c3d-b4ed-100bac8fea49");
  expect(safeNextPath("/me")).toBe("/me");
});

test("anything that could leave the site falls back to the lists", () => {
  for (const raw of [null, "", "lists", "//evil.example", "/\\evil.example", "https://evil.example/lists", "/lists\nx"]) {
    expect(safeNextPath(raw)).toBe(DEFAULT_NEXT_PATH);
  }
});
```

Run: `pnpm vitest run apps/web/src/app/tg`
Expected: FAIL — `Failed to resolve import "./next-path"`.

- [ ] **Step 8: `/tg?next=` — реализация**

`apps/web/src/app/tg/next-path.ts`:
```ts
export const DEFAULT_NEXT_PATH = "/lists";

// Только относительный путь внутри сайта: "//host" и "/\host" браузер понимает как другой домен
export function safeNextPath(raw: string | null): string {
  if (!raw || !/^\/[A-Za-z0-9/_-]*$/.test(raw) || raw.startsWith("//")) return DEFAULT_NEXT_PATH;
  return raw;
}
```

`apps/web/src/app/tg/TelegramAutoLogin.tsx`: импорт
```ts
import { safeNextPath } from "./next-path";
```
и заменить `router.replace("/lists");` на
```ts
        router.replace(safeNextPath(new URLSearchParams(window.location.search).get("next")));
```

Run: `pnpm vitest run apps/web`
Expected: PASS.

- [ ] **Step 9: Проверка и commit**

Run: `pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS.

```bash
git add apps/web packages/db
git commit -m "feat(web): reservation and deletion notices, Telegram reminder link, bot deep links into lists"
```

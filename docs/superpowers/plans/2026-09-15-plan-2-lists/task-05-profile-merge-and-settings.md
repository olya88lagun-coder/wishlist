# Task 5: Объединение пустых профилей и режим «Полный сюрприз»

Итог проверки плана 1 на проде: если человек сначала вошёл через VK (создался отдельный профиль), а потом через Telegram, привязать VK было нельзя (`link_IDENTITY_TAKEN`). Решение: при привязке аккаунта, который принадлежит **пустому** профилю (нет списков и нет броней от имени этого пользователя), аккаунт переносится к текущему пользователю, а пустой профиль удаляется. Непустой чужой профиль по-прежнему даёт `IDENTITY_TAKEN`.

**Files:**
- Modify: `packages/db/src/users.ts`, `packages/db/src/users.test.ts`
- Modify: `apps/web/src/server/auth-service.test.ts`

**Interfaces:**
- Consumes: `users`, `authIdentities`, `wishlists`, `reservations` (план 1); `createWishlist` (Task 2).
- Produces (изменения и новое):
  ```ts
  function isProfileEmpty(db: Database, userId: string): Promise<boolean>;
  function linkIdentity(db: Database, userId: string, input: IdentityInput): Promise<{ ok: true } | { ok: false; reason: "IDENTITY_TAKEN" | "PROVIDER_ALREADY_LINKED" }>;  // сигнатура прежняя, поведение: merge пустого профиля
  function setSurpriseMode(db: Database, userId: string, enabled: boolean): Promise<void>;
  ```

- [ ] **Step 1: Обновить существующий тест и добавить падающие**

В `packages/db/src/users.test.ts`:

1. Добавить импорты:
```ts
import { eq } from "drizzle-orm";
import { reservations, users } from "./schema";
import { createWishlist } from "./wishlists";
import { addItem } from "./items";
import { isProfileEmpty, setSurpriseMode } from "./users";
```
(объединить с уже существующим импортом из `./users`.)

2. Заменить тест `"refuses to steal an identity that belongs to another user"` на:
```ts
  test("refuses to steal an identity from a profile that has data", async () => {
    const vkUser = await upsertUserFromIdentity(db, vk);
    await createWishlist(db, vkUser.id, { title: "Мой список", occasion: "other", eventDate: null });
    const other = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, other.id, vk)).toEqual({ ok: false, reason: "IDENTITY_TAKEN" });
  });

  test("merges an identity from an empty profile and deletes that profile", async () => {
    const emptyVkProfile = await upsertUserFromIdentity(db, vk);
    const current = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, current.id, vk)).toEqual({ ok: true });
    expect(await getUserWithIdentities(db, emptyVkProfile.id)).toBeNull();
    expect((await getUserWithIdentities(db, current.id))?.providers.sort()).toEqual(["telegram", "vk"]);
    expect((await upsertUserFromIdentity(db, vk)).id).toBe(current.id);
  });

  test("does not merge a profile that reserved gifts as a guest", async () => {
    const vkUser = await upsertUserFromIdentity(db, vk);
    const owner = await upsertUserFromIdentity(db, { ...tg, providerUserId: "999" });
    const list = await createWishlist(db, owner.id, { title: "Чужой", occasion: "other", eventDate: null });
    if (!list.ok) throw new Error("setup");
    const item = await addItem(db, owner.id, list.wishlist.id, { title: "X", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    if (!item.ok) throw new Error("setup");
    await db.insert(reservations).values({ itemId: item.itemId, guestUserId: vkUser.id, guestName: "Мария", cancelToken: "c" });
    const current = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, current.id, vk)).toEqual({ ok: false, reason: "IDENTITY_TAKEN" });
  });

  test("merge still respects one account per provider", async () => {
    await upsertUserFromIdentity(db, { ...vk, providerUserId: "888" });
    const current = await upsertUserFromIdentity(db, tg);
    await linkIdentity(db, current.id, vk);
    expect(await linkIdentity(db, current.id, { ...vk, providerUserId: "888" })).toEqual({ ok: false, reason: "PROVIDER_ALREADY_LINKED" });
  });
```

3. Добавить в конец файла:
```ts
describe("isProfileEmpty", () => {
  test("true for a fresh user, false once they own a list", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(await isProfileEmpty(db, user.id)).toBe(true);
    await createWishlist(db, user.id, { title: "Список", occasion: "other", eventDate: null });
    expect(await isProfileEmpty(db, user.id)).toBe(false);
  });
});

describe("setSurpriseMode", () => {
  test("toggles the flag", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    await setSurpriseMode(db, user.id, true);
    expect((await getUserWithIdentities(db, user.id))?.surpriseMode).toBe(true);
    await setSurpriseMode(db, user.id, false);
    const [row] = await db.select({ surpriseMode: users.surpriseMode }).from(users).where(eq(users.id, user.id));
    expect(row?.surpriseMode).toBe(false);
  });
});
```

В `apps/web/src/server/auth-service.test.ts` заменить тест `"linking an identity owned by someone else fails"` на:
```ts
  test("linking an identity owned by a non-empty profile fails", async () => {
    const vkOwner = await vkLogin("777", null);
    await createWishlist(deps.db, vkOwner.userId, { title: "Список VK", occasion: "other", eventDate: null });
    const tgUser = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    if (!tgUser.ok) throw new Error("setup");
    const started = await startVkLogin(deps, tgUser.sessionToken);
    const state = new URL(started.redirectUrl).searchParams.get("state");
    vi.mocked(deps.fetchFn)
      .mockResolvedValueOnce(json({ access_token: "at" }))
      .mockResolvedValueOnce(json({ user: { user_id: "777", first_name: "Мария" } }));
    const result = await finishVkLogin(deps, { code: "c", deviceId: "d", state, stateCookie: started.stateCookie, currentSessionToken: tgUser.sessionToken });
    expect(result).toEqual({ ok: false, error: "link_IDENTITY_TAKEN" });
  });

  test("linking VK from an empty earlier profile merges it into the current user", async () => {
    await vkLogin("777", null);
    const tgUser = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    if (!tgUser.ok) throw new Error("setup");
    const linked = await vkLogin("777", tgUser.sessionToken);
    expect(linked.userId).toBe(tgUser.userId);
    expect((await getUserWithIdentities(deps.db, tgUser.userId))?.providers.sort()).toEqual(["telegram", "vk"]);
  });
```
и добавить импорт: `import { createWishlist, getUserWithIdentities } from "@wishlist/db";` (объединив с существующим импортом `getUserWithIdentities`).

Run: `pnpm vitest run packages/db/src/users.test.ts apps/web`
Expected: FAIL — `isProfileEmpty`/`setSurpriseMode` не экспортируются; тест merge падает с `IDENTITY_TAKEN`.

- [ ] **Step 2: Реализация**

В `packages/db/src/users.ts`:

1. Импорты заменить на:
```ts
import { and, eq } from "drizzle-orm";
import { authIdentities, type AuthProvider, reservations, users, wishlists } from "./schema";
import type { Database } from "./types";
```

2. Заменить функцию `linkIdentity` и добавить новые функции:
```ts
export async function isProfileEmpty(db: Database, userId: string): Promise<boolean> {
  const [list] = await db.select({ id: wishlists.id }).from(wishlists).where(eq(wishlists.ownerId, userId)).limit(1);
  if (list) return false;
  const [reservation] = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.guestUserId, userId)).limit(1);
  return !reservation;
}

export async function linkIdentity(
  db: Database,
  userId: string,
  input: IdentityInput,
): Promise<{ ok: true } | { ok: false; reason: "IDENTITY_TAKEN" | "PROVIDER_ALREADY_LINKED" }> {
  const owner = await findIdentityOwner(db, input.provider, input.providerUserId);
  if (owner === userId) return { ok: true };

  const sameProvider = await db
    .select({ id: authIdentities.id })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, input.provider)))
    .limit(1);
  if (sameProvider.length > 0) return { ok: false, reason: "PROVIDER_ALREADY_LINKED" };

  if (owner === null) {
    await db.insert(authIdentities).values({ userId, provider: input.provider, providerUserId: input.providerUserId });
    return { ok: true };
  }

  if (!(await isProfileEmpty(db, owner))) return { ok: false, reason: "IDENTITY_TAKEN" };

  // Пустой профиль остался от входа другим способом: переносим аккаунт и удаляем профиль-пустышку
  await db.transaction(async (tx) => {
    await tx
      .update(authIdentities)
      .set({ userId })
      .where(and(eq(authIdentities.provider, input.provider), eq(authIdentities.providerUserId, input.providerUserId)));
    await tx.delete(users).where(eq(users.id, owner));
  });
  return { ok: true };
}

export async function setSurpriseMode(db: Database, userId: string, enabled: boolean): Promise<void> {
  await db.update(users).set({ surpriseMode: enabled }).where(eq(users.id, userId));
}
```

Порядок проверок поменялся по сравнению с планом 1: `PROVIDER_ALREADY_LINKED` проверяется раньше, чем `IDENTITY_TAKEN`. Существующий тест `"refuses a second account of the same provider"` остаётся зелёным.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm test && pnpm typecheck`
Expected: PASS все проекты.

- [ ] **Step 4: Commit**

```bash
git add packages/db apps/web
git commit -m "feat(auth): merge empty profiles on account linking, surprise mode setter"
```

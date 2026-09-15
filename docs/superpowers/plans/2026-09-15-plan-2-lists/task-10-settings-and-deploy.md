# Task 10: Настройки профиля, деплой, проверка на проде

**Files:**
- Create: `apps/web/src/app/me/actions.ts`, `apps/web/src/app/me/SurpriseModeForm.tsx`
- Modify: `apps/web/src/app/me/page.tsx`, `deploy/server-setup.md`, `docs/superpowers/plans/2026-09-15-plan-2-lists/00-overview.md` (статус)

**Interfaces:**
- Consumes: `setSurpriseMode` (Task 5); `requireUser` (Task 6); `SubmitButton` (Task 7); `FormState`, `initialFormState`, `successState` (Task 8).
- Produces:
  ```ts
  // me/actions.ts ("use server")
  function saveSurpriseModeAction(prev: FormState, form: FormData): Promise<FormState>;
  ```

- [x] **Step 1: Действие и форма режима сюрприза**

`apps/web/src/app/me/actions.ts`:
```ts
"use server";

import { setSurpriseMode } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { type FormState, successState } from "../lists/form-state";

export async function saveSurpriseModeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const enabled = form.get("surpriseMode") === "on";
  await setSurpriseMode(getDb(), user.id, enabled);
  revalidatePath("/me");
  revalidatePath("/lists", "layout");
  return successState(enabled ? "Полный сюрприз включён" : "Полный сюрприз выключен");
}
```

`apps/web/src/app/me/SurpriseModeForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../lists/form-state";
import { saveSurpriseModeAction } from "./actions";

export function SurpriseModeForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(saveSurpriseModeAction, initialFormState);
  return (
    <form action={action} className="panel stack">
      <label className="checkbox">
        <input type="checkbox" name="surpriseMode" defaultChecked={enabled} /> Полный сюрприз
      </label>
      <p className="muted" style={{ margin: 0 }}>
        Вы не увидите даже того, что подарок забронирован. Гости по-прежнему видят брони друг друга.
      </p>
      {state.message && <p className="muted" role="status" style={{ margin: 0 }}>{state.message}</p>}
      <SubmitButton pendingText="Сохраняем…" variant="ghost">Сохранить</SubmitButton>
    </form>
  );
}
```

- [x] **Step 2: Страница профиля**

`apps/web/src/app/me/page.tsx` (заменить целиком):
```tsx
import Link from "next/link";
import { requireUser } from "@/server/viewer";
import { SurpriseModeForm } from "./SurpriseModeForm";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = { telegram: "Telegram", vk: "VK ID" };

export default async function MePage() {
  const user = await requireUser();
  const hasVk = user.providers.includes("vk");
  const hasTelegram = user.providers.includes("telegram");
  return (
    <main className="page stack">
      <Link className="eyebrow" href="/lists">← Мои списки</Link>
      <h1 className="display" style={{ marginBottom: 0 }}>
        {user.displayName.split(" ")[0]}, <i>это вы</i>
      </h1>
      <p className="muted">Вход через: {user.providers.map((p) => PROVIDER_LABEL[p] ?? p).join(", ")}</p>
      {!hasVk && <a className="button button--ghost button--block" href="/api/auth/vk/start">Привязать VK ID</a>}
      {!hasTelegram && <p className="muted">Чтобы привязать Telegram, нажмите «Войти через Telegram» на странице входа, не выходя из профиля.</p>}
      <SurpriseModeForm enabled={user.surpriseMode} />
      <form action="/api/auth/logout" method="post">
        <button className="button button--ghost button--block" type="submit">Выйти</button>
      </form>
    </main>
  );
}
```

- [x] **Step 3: Полная проверка локально**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS все проекты.

Ручная проверка (`pnpm dev:db` + `pnpm dev:web`): войти dev-входом, забронировать подарок из инкогнито, затем в `/me` включить «Полный сюрприз» → на странице списка стикер «забронировано» исчез; выключить → вернулся.

- [x] **Step 4: Commit, push ветки, CI**

```bash
git add apps/web
git commit -m "feat(web): surprise mode setting on profile page"
git push -u origin feat/lists
```
Попросить пользователя проверить вкладку Actions: запуск `ci` на `feat/lists` — зелёный. При красном — получить текст ошибки и исправить до мержа.

- [x] **Step 5: Мерж в master (с согласия пользователя)**

```bash
git checkout master
git merge --ff-only feat/lists
git push
```
Дождаться зелёного `images` (web, migrate).

- [x] **Step 6: Деплой (с явного «да» пользователя)**

```bash
ssh root@200.169.178.231 '
set -e
cd /opt/wishlist
docker compose pull
docker compose run --rm migrate
docker compose up -d web
sleep 25
docker compose ps
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"
curl -fsS https://my-wish-list.online/api/health'
```
Expected: `migrations applied` (новых миграций нет — команда проходит без изменений), `wishlist-web-1 … (healthy)`, память < 300MiB, `{"ok":true}`.

- [x] **Step 7: Проверка на проде вместе с пользователем**

1. Открыть бота → кнопка меню → Mini App открывает «Мои списки».
2. Создать список «Тест», повод ДР, дата через неделю → стикер «ДР через 7 дней».
3. Добавить 2 подарка: один со ссылкой на Wildberries и ценой, второй без ссылки.
4. «Скопировать ссылку» / «Telegram» → отправить ссылку себе в «Избранное» → открыть в браузере телефона **без входа**.
5. Как гость: «Я подарю» → имя → подарок помечен «вы дарите».
6. В Mini App (владелец): у подарка «забронировано», имени гостя нет.
7. Профиль → «Полный сюрприз» → в списке стикер пропал.
8. Гость → «Снять бронь» → подарок свободен.
9. Удалить тестовый список в «Настройках списка».

Проверка логов после сценария:
```bash
ssh root@200.169.178.231 'docker logs --since 30m wishlist-web-1 2>&1 | grep -iE "error|warn" | grep -v "Server Reference ID" | tail -20'
```
Expected: нет ошибок нашего приложения (строки сканеров `Server Reference ID` отфильтрованы).

- [x] **Step 8: Статус плана**

В `docs/superpowers/plans/2026-09-15-plan-2-lists/00-overview.md` под заголовком добавить строку:
```
> **Статус: выполнен YYYY-MM-DD.** Прод: https://my-wish-list.online — списки, подарки, бронирование гостем и режим сюрприза проверены вручную.
```
(подставить фактическую дату), отметить все шаги задач `[x]`.

```bash
git add docs
git commit -m "docs: mark plan 2 done"
git push
```

# Task 8: Страницы владельца — «Мои списки», список, подарки

**Files:**
- Create: `apps/web/src/app/lists/form-state.ts`, `apps/web/src/app/lists/actions.ts`, `apps/web/src/app/lists/page.tsx`, `apps/web/src/app/lists/CreateListForm.tsx`
- Create: `apps/web/src/app/lists/[id]/actions.ts`, `apps/web/src/app/lists/[id]/page.tsx`, `apps/web/src/app/lists/[id]/ItemFields.tsx`, `apps/web/src/app/lists/[id]/AddItemForm.tsx`, `apps/web/src/app/lists/[id]/ItemEditor.tsx`, `apps/web/src/app/lists/[id]/ListSettings.tsx`, `apps/web/src/app/lists/[id]/ConfirmButton.tsx`
- Modify: `apps/web/src/app/page.tsx`, `apps/web/src/app/tg/TelegramAutoLogin.tsx`, `apps/web/src/app/api/auth/telegram/widget/route.ts`, `apps/web/src/app/api/auth/vk/callback/route.ts`
- Test: `apps/web/src/app/lists/form-state.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `readViewer`, `clientKey`, `editLimiter` (Task 6); `parseWishlistForm`, `parseItemForm`, `FieldErrors` (Task 6); `createWishlist`, `listWishlistsForOwner`, `updateWishlist`, `deleteWishlist`, `addItem`, `updateItem`, `deleteItem`, `getOwnerWishlistView`, `OwnerItemView` (Tasks 2–3); `ItemCard`, `ReservedSticker`, `CountdownSticker`, `EmptyState`, `SubmitButton` (Task 7); `getDb` (план 1).
- Produces:
  ```ts
  // form-state.ts
  type FormState = { status: "idle" | "error" | "success"; errors: FieldErrors; message: string | null };
  const initialFormState: FormState;
  function errorState(errors: FieldErrors, message?: string): FormState;
  function successState(message?: string): FormState;
  const LIMIT_MESSAGES: { wishlists: string; items: string; rate: string; notFound: string };
  // lists/actions.ts ("use server")
  function createListAction(prev: FormState, form: FormData): Promise<FormState>;       // redirect на /lists/[id] при успехе
  // lists/[id]/actions.ts ("use server")
  function updateListAction(wishlistId: string, prev: FormState, form: FormData): Promise<FormState>;
  function deleteListAction(wishlistId: string): Promise<void>;                          // redirect на /lists
  function addItemAction(wishlistId: string, prev: FormState, form: FormData): Promise<FormState>;
  function updateItemAction(wishlistId: string, itemId: string, prev: FormState, form: FormData): Promise<FormState>;
  function deleteItemAction(wishlistId: string, itemId: string): Promise<void>;
  ```
- Маршруты: `/` → `/lists` (вошёл) или `/login`; после входа (виджет, VK, Mini App) → `/lists`.

- [x] **Step 1: Состояние форм (тест → реализация)**

`apps/web/src/app/lists/form-state.test.ts`:
```ts
import { expect, test } from "vitest";
import { errorState, initialFormState, successState } from "./form-state";

test("form state helpers", () => {
  expect(initialFormState).toEqual({ status: "idle", errors: {}, message: null });
  expect(errorState({ title: "Введите название" })).toEqual({ status: "error", errors: { title: "Введите название" }, message: null });
  expect(errorState({}, "Слишком часто")).toEqual({ status: "error", errors: {}, message: "Слишком часто" });
  expect(successState("Сохранено")).toEqual({ status: "success", errors: {}, message: "Сохранено" });
});
```

Run: `pnpm vitest run apps/web/src/app/lists`
Expected: FAIL — `Cannot find module './form-state'`.

`apps/web/src/app/lists/form-state.ts`:
```ts
import type { FieldErrors } from "@/server/forms";

export type FormState = { status: "idle" | "error" | "success"; errors: FieldErrors; message: string | null };

export const initialFormState: FormState = { status: "idle", errors: {}, message: null };

export function errorState(errors: FieldErrors, message: string | null = null): FormState {
  return { status: "error", errors, message };
}

export function successState(message: string | null = null): FormState {
  return { status: "success", errors: {}, message };
}

export const LIMIT_MESSAGES = {
  wishlists: "Достигнут лимит списков. Удалите ненужный, чтобы создать новый.",
  items: "В списке уже максимум подарков.",
  rate: "Слишком много действий подряд. Подождите минуту.",
  notFound: "Список не найден или был удалён.",
} as const;
```

Run: `pnpm vitest run apps/web/src/app/lists`
Expected: PASS.

- [x] **Step 2: Действия «Мои списки»**

`apps/web/src/app/lists/actions.ts`:
```ts
"use server";

import { createWishlist } from "@wishlist/db";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { parseWishlistForm } from "@/server/forms";
import { editLimiter } from "@/server/rate-limit";
import { clientKey, requireUser } from "@/server/viewer";
import { errorState, type FormState, LIMIT_MESSAGES } from "./form-state";

export async function createListAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!editLimiter.allow(await clientKey({ userId: user.id, guestToken: null }))) return errorState({}, LIMIT_MESSAGES.rate);
  const parsed = parseWishlistForm(form);
  if (!parsed.ok) return errorState(parsed.errors);
  const created = await createWishlist(getDb(), user.id, parsed.value);
  if (!created.ok) return errorState({}, LIMIT_MESSAGES.wishlists);
  redirect(`/lists/${created.wishlist.id}`);
}
```

- [x] **Step 3: Страница «Мои списки» и форма создания**

`apps/web/src/app/lists/CreateListForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { createListAction } from "./actions";
import { initialFormState } from "./form-state";

export function CreateListForm({ defaultOpen }: { defaultOpen: boolean }) {
  const [state, action] = useActionState(createListAction, initialFormState);
  return (
    <details className="panel" open={defaultOpen || state.status === "error"}>
      <summary className="serif" style={{ fontSize: 20, cursor: "pointer" }}>Новый список</summary>
      <form action={action} className="stack" style={{ marginTop: 14 }} noValidate>
        <div className="field">
          <label htmlFor="title">Название</label>
          <input id="title" name="title" className="input" placeholder="Маше тридцать" maxLength={80} required />
          {state.errors.title && <p className="error">{state.errors.title}</p>}
        </div>
        <div className="field">
          <label htmlFor="occasion">Повод</label>
          <select id="occasion" name="occasion" className="select" defaultValue="birthday">
            <option value="birthday">День рождения</option>
            <option value="new_year">Новый год</option>
            <option value="other">Другой праздник</option>
          </select>
          {state.errors.occasion && <p className="error">{state.errors.occasion}</p>}
        </div>
        <div className="field">
          <label htmlFor="eventDate">Дата праздника</label>
          <input id="eventDate" name="eventDate" type="date" className="input" />
          {state.errors.eventDate && <p className="error">{state.errors.eventDate}</p>}
        </div>
        {state.message && <p className="error">{state.message}</p>}
        <SubmitButton pendingText="Создаём…">Создать список</SubmitButton>
      </form>
    </details>
  );
}
```

`apps/web/src/app/lists/page.tsx`:
```tsx
import { listWishlistsForOwner } from "@wishlist/db";
import Link from "next/link";
import { CountdownSticker } from "@/components/CountdownSticker";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { CreateListForm } from "./CreateListForm";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const user = await requireUser();
  const lists = await listWishlistsForOwner(getDb(), user.id);
  return (
    <main className="page">
      <div className="row row--between">
        <p className="eyebrow">Привет, {user.displayName.split(" ")[0]}</p>
        <Link className="muted" href="/me">Профиль</Link>
      </div>
      <h1 className="display">
        Мои <i>списки</i>
      </h1>
      {lists.length > 0 && (
        <nav aria-label="Мои списки" style={{ marginBottom: 24 }}>
          {lists.map((list) => (
            <Link key={list.id} href={`/lists/${list.id}`} className="list-row">
              <div>
                <p className="list-row__title">{list.title}</p>
                <p className="muted" style={{ margin: 0 }}>
                  {list.itemCount === 0 ? "Пока без подарков" : `Подарков: ${list.itemCount}`}
                </p>
              </div>
              <CountdownSticker occasion={list.occasion} eventDate={list.eventDate} />
            </Link>
          ))}
        </nav>
      )}
      <CreateListForm defaultOpen={lists.length === 0} />
    </main>
  );
}
```

- [x] **Step 4: Действия страницы списка**

`apps/web/src/app/lists/[id]/actions.ts`:
```ts
"use server";

import { addItem, deleteItem, deleteWishlist, updateItem, updateWishlist } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { parseItemForm, parseWishlistForm } from "@/server/forms";
import { editLimiter } from "@/server/rate-limit";
import { clientKey, requireUser } from "@/server/viewer";
import { errorState, type FormState, LIMIT_MESSAGES, successState } from "../form-state";

async function authorizedOwner() {
  const user = await requireUser();
  const allowed = editLimiter.allow(await clientKey({ userId: user.id, guestToken: null }));
  return { user, allowed };
}

export async function updateListAction(wishlistId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, allowed } = await authorizedOwner();
  if (!allowed) return errorState({}, LIMIT_MESSAGES.rate);
  const parsed = parseWishlistForm(form);
  if (!parsed.ok) return errorState(parsed.errors);
  if (!(await updateWishlist(getDb(), user.id, wishlistId, parsed.value))) return errorState({}, LIMIT_MESSAGES.notFound);
  revalidatePath(`/lists/${wishlistId}`);
  return successState("Сохранено");
}

export async function deleteListAction(wishlistId: string): Promise<void> {
  const { user } = await authorizedOwner();
  await deleteWishlist(getDb(), user.id, wishlistId);
  revalidatePath("/lists");
  redirect("/lists");
}

export async function addItemAction(wishlistId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, allowed } = await authorizedOwner();
  if (!allowed) return errorState({}, LIMIT_MESSAGES.rate);
  const parsed = parseItemForm(form);
  if (!parsed.ok) return errorState(parsed.errors);
  const result = await addItem(getDb(), user.id, wishlistId, parsed.value);
  if (!result.ok) return errorState({}, result.reason === "LIMIT_REACHED" ? LIMIT_MESSAGES.items : LIMIT_MESSAGES.notFound);
  revalidatePath(`/lists/${wishlistId}`);
  return successState("Подарок добавлен");
}

export async function updateItemAction(wishlistId: string, itemId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, allowed } = await authorizedOwner();
  if (!allowed) return errorState({}, LIMIT_MESSAGES.rate);
  const parsed = parseItemForm(form);
  if (!parsed.ok) return errorState(parsed.errors);
  if (!(await updateItem(getDb(), user.id, itemId, parsed.value))) return errorState({}, LIMIT_MESSAGES.notFound);
  revalidatePath(`/lists/${wishlistId}`);
  return successState("Сохранено");
}

export async function deleteItemAction(wishlistId: string, itemId: string): Promise<void> {
  const { user } = await authorizedOwner();
  await deleteItem(getDb(), user.id, itemId);
  revalidatePath(`/lists/${wishlistId}`);
}
```

- [x] **Step 5: Клиентские формы страницы списка**

`apps/web/src/app/lists/[id]/ItemFields.tsx` — общий набор полей для добавления и редактирования:
```tsx
import type { FieldErrors } from "@/server/forms";

export type ItemDefaults = { title: string; url: string; price: string; note: string; isMustHave: boolean };

export function ItemFields({ idPrefix, defaults, errors }: { idPrefix: string; defaults: ItemDefaults; errors: FieldErrors }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="field">
        <label htmlFor={id("url")}>Ссылка на товар</label>
        <input id={id("url")} name="url" type="url" inputMode="url" className="input" placeholder="https://www.wildberries.ru/…" defaultValue={defaults.url} />
        {errors.url && <p className="error">{errors.url}</p>}
      </div>
      <div className="field">
        <label htmlFor={id("title")}>Что подарить</label>
        <input id={id("title")} name="title" className="input" placeholder="Наушники Sony" maxLength={200} defaultValue={defaults.title} required />
        {errors.title && <p className="error">{errors.title}</p>}
      </div>
      <div className="field">
        <label htmlFor={id("price")}>Цена, ₽</label>
        <input id={id("price")} name="price" inputMode="decimal" className="input" placeholder="2 490" defaultValue={defaults.price} />
        {errors.price && <p className="error">{errors.price}</p>}
      </div>
      <div className="field">
        <label htmlFor={id("note")}>Заметка</label>
        <textarea id={id("note")} name="note" className="textarea" placeholder="Размер M, чёрные" maxLength={300} defaultValue={defaults.note} />
        {errors.note && <p className="error">{errors.note}</p>}
      </div>
      <label className="checkbox">
        <input type="checkbox" name="isMustHave" defaultChecked={defaults.isMustHave} /> Очень хочу
      </label>
    </>
  );
}
```

`apps/web/src/app/lists/[id]/AddItemForm.tsx`:
```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../form-state";
import { addItemAction } from "./actions";
import { ItemFields } from "./ItemFields";

const EMPTY = { title: "", url: "", price: "", note: "", isMustHave: false };

export function AddItemForm({ wishlistId, defaultOpen }: { wishlistId: string; defaultOpen: boolean }) {
  const [state, action] = useActionState(addItemAction.bind(null, wishlistId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <details className="panel" open={defaultOpen || state.status === "error"} style={{ marginBottom: 24 }}>
      <summary className="serif" style={{ fontSize: 20, cursor: "pointer" }}>Добавить подарок</summary>
      <form ref={formRef} action={action} className="stack" style={{ marginTop: 14 }} noValidate>
        <ItemFields idPrefix="new" defaults={EMPTY} errors={state.errors} />
        {state.message && <p className={state.status === "error" ? "error" : "muted"} role="status">{state.message}</p>}
        <SubmitButton pendingText="Добавляем…">Добавить</SubmitButton>
      </form>
    </details>
  );
}
```

`apps/web/src/app/lists/[id]/ItemEditor.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../form-state";
import { updateItemAction } from "./actions";
import { type ItemDefaults, ItemFields } from "./ItemFields";

export function ItemEditor({ wishlistId, itemId, defaults }: { wishlistId: string; itemId: string; defaults: ItemDefaults }) {
  const [state, action] = useActionState(updateItemAction.bind(null, wishlistId, itemId), initialFormState);
  return (
    <details>
      <summary className="link-button">Изменить</summary>
      <form action={action} className="stack panel" style={{ marginTop: 8 }} noValidate>
        <ItemFields idPrefix={`edit-${itemId}`} defaults={defaults} errors={state.errors} />
        {state.message && <p className={state.status === "error" ? "error" : "muted"} role="status">{state.message}</p>}
        <SubmitButton pendingText="Сохраняем…">Сохранить</SubmitButton>
      </form>
    </details>
  );
}
```

`apps/web/src/app/lists/[id]/ConfirmButton.tsx`:
```tsx
"use client";

import type { ReactNode } from "react";

export function ConfirmButton({ action, question, children, className = "link-button link-button--danger" }: {
  action: () => Promise<void>;
  question: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form action={action} onSubmit={(event) => { if (!window.confirm(question)) event.preventDefault(); }}>
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}
```

`apps/web/src/app/lists/[id]/ListSettings.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { WishlistSummary } from "@wishlist/db";
import { initialFormState } from "../form-state";
import { deleteListAction, updateListAction } from "./actions";
import { ConfirmButton } from "./ConfirmButton";

export function ListSettings({ wishlist }: { wishlist: Pick<WishlistSummary, "id" | "title" | "occasion" | "eventDate"> }) {
  const [state, action] = useActionState(updateListAction.bind(null, wishlist.id), initialFormState);
  return (
    <details className="panel" style={{ marginTop: 32 }}>
      <summary className="muted" style={{ cursor: "pointer" }}>Настройки списка</summary>
      <form action={action} className="stack" style={{ marginTop: 14 }} noValidate>
        <div className="field">
          <label htmlFor="list-title">Название</label>
          <input id="list-title" name="title" className="input" maxLength={80} defaultValue={wishlist.title} />
          {state.errors.title && <p className="error">{state.errors.title}</p>}
        </div>
        <div className="field">
          <label htmlFor="list-occasion">Повод</label>
          <select id="list-occasion" name="occasion" className="select" defaultValue={wishlist.occasion}>
            <option value="birthday">День рождения</option>
            <option value="new_year">Новый год</option>
            <option value="other">Другой праздник</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="list-date">Дата праздника</label>
          <input id="list-date" name="eventDate" type="date" className="input" defaultValue={wishlist.eventDate ?? ""} />
          {state.errors.eventDate && <p className="error">{state.errors.eventDate}</p>}
        </div>
        {state.message && <p className={state.status === "error" ? "error" : "muted"} role="status">{state.message}</p>}
        <SubmitButton pendingText="Сохраняем…" variant="ghost">Сохранить</SubmitButton>
      </form>
      <div style={{ marginTop: 16 }}>
        <ConfirmButton action={deleteListAction.bind(null, wishlist.id)} question="Удалить список со всеми подарками и бронями? Это нельзя отменить.">
          Удалить список
        </ConfirmButton>
      </div>
    </details>
  );
}
```

Если typecheck ругается на импорт типа `WishlistSummary` из `@wishlist/db` в клиентском компоненте — это только тип (`import type`), в бандл он не попадает; при необходимости заменить на локальный тип `{ id: string; title: string; occasion: "birthday" | "new_year" | "other"; eventDate: string | null }`.

- [x] **Step 6: Страница списка владельца**

`apps/web/src/app/lists/[id]/page.tsx`:
```tsx
import { formatKopecks } from "@wishlist/core";
import { getOwnerWishlistView, type OwnerItemView } from "@wishlist/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountdownSticker } from "@/components/CountdownSticker";
import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/ItemCard";
import { ReservedSticker } from "@/components/ReservedSticker";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { deleteItemAction } from "./actions";
import { AddItemForm } from "./AddItemForm";
import { ConfirmButton } from "./ConfirmButton";
import { ItemEditor } from "./ItemEditor";
import { ListSettings } from "./ListSettings";

export const dynamic = "force-dynamic";

function editorDefaults(item: OwnerItemView) {
  return {
    title: item.title,
    url: item.sourceUrl ?? "",
    price: item.priceKopecks === null ? "" : formatKopecks(item.priceKopecks).replace(/ ₽$/, ""),
    note: item.note ?? "",
    isMustHave: item.isMustHave,
  };
}

export default async function OwnerListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const view = await getOwnerWishlistView(getDb(), user.id, id);
  if (!view) notFound();
  const { wishlist, items, surpriseMode } = view;

  return (
    <main className="page page--wide">
      <div className="row row--between">
        <Link className="eyebrow" href="/lists">← Мои списки</Link>
        <CountdownSticker occasion={wishlist.occasion} eventDate={wishlist.eventDate} />
      </div>
      <h1 className="display">{wishlist.title}</h1>
      <div className="row" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        <Link className="button button--ghost button--small" href={`/${wishlist.slug}`}>Как видят гости</Link>
        {surpriseMode && <span className="muted">Режим «Полный сюрприз»: брони скрыты</span>}
      </div>

      <AddItemForm wishlistId={wishlist.id} defaultOpen={items.length === 0} />

      {items.length === 0 ? (
        <EmptyState title="Здесь будут подарки" text="Вставьте ссылку из любого магазина или просто напишите, что хотите." />
      ) : (
        <section className="grid" aria-label="Подарки">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} dimmed={item.reserved} sticker={item.reserved ? <ReservedSticker label="забронировано" /> : undefined}>
              <ItemEditor wishlistId={wishlist.id} itemId={item.id} defaults={editorDefaults(item)} />
              <ConfirmButton action={deleteItemAction.bind(null, wishlist.id, item.id)} question={`Удалить «${item.title}»?`}>
                Удалить
              </ConfirmButton>
            </ItemCard>
          ))}
        </section>
      )}

      <ListSettings wishlist={wishlist} />
    </main>
  );
}
```

Примечание к `editorDefaults`: `formatKopecks` возвращает «24 990 ₽» с неразрывными пробелами; для поля ввода отрезаем « ₽», а неразрывные пробелы парсер цены (`parseRublesToKopecks`) принимает.

- [x] **Step 7: Перенаправления после входа**

`apps/web/src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { readViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user } = await readViewer();
  redirect(user ? "/lists" : "/login");
}
```

В `apps/web/src/app/tg/TelegramAutoLogin.tsx` заменить `router.replace("/me")` на `router.replace("/lists")`.

В `apps/web/src/app/api/auth/telegram/widget/route.ts` заменить `new URL("/me", deps.env.APP_URL)` на `new URL("/lists", deps.env.APP_URL)`.

В `apps/web/src/app/api/auth/vk/callback/route.ts` заменить `const target = result.ok ? "/me" : ...` на `const target = result.ok ? "/lists" : ...`.

- [x] **Step 8: Проверка локально**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS, сборка успешна, в таблице маршрутов есть `ƒ /lists` и `ƒ /lists/[id]`.

Ручная проверка (терминал 1: `pnpm dev:db`, терминал 2: `pnpm dev:web`):
1. `http://localhost:3000/api/dev/login?name=Маша` → «Мои списки», форма «Новый список» раскрыта.
2. Создать список «Маше 30», повод ДР, дата через 12 дней → страница списка, стикер «ДР через 12 дней».
3. Добавить подарок со ссылкой `https://www.wildberries.ru/catalog/173937886/detail.aspx?utm_source=x`, цена `1 472` → карточка с плашкой «Wildberries», «1 472 ₽»; форма очистилась.
4. Отправить форму с пустым названием → «Введите название подарка», форма не закрылась.
5. «Изменить» → поменять цену → «Сохранено»; «Удалить» → подтверждение → карточка исчезла.
6. «Настройки списка» → переименовать → заголовок обновился.

- [x] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): owner pages for lists and items"
```

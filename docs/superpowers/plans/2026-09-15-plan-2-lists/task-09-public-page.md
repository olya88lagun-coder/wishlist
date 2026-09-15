# Task 9: Публичная страница списка, бронирование гостем, «Поделиться»

**Files:**
- Create: `apps/web/src/app/[slug]/page.tsx`, `apps/web/src/app/[slug]/actions.ts`, `apps/web/src/app/[slug]/ReserveSheet.tsx`, `apps/web/src/app/[slug]/CancelReservationButton.tsx`, `apps/web/src/app/[slug]/reserve-messages.ts`
- Create: `apps/web/src/components/ShareBar.tsx`
- Test: `apps/web/src/app/[slug]/reserve-messages.test.ts`
- Modify: `apps/web/src/app/lists/[id]/page.tsx` (добавить ShareBar)

**Interfaces:**
- Consumes: `getPublicWishlist`, `reserveItem`, `cancelReservation`, `ReserveResult`, `CancelResult`, `PublicItemView` (Task 4); `readViewer`, `ensureGuestViewer`, `clientKey`, `reservationLimiter` (Task 6); `ItemCard`, `ReservedSticker`, `CountdownSticker`, `EmptyState`, `SubmitButton`, `toCardModel` (Task 7); `FormState`, `initialFormState`, `errorState`, `successState`, `LIMIT_MESSAGES` (Task 8); `getEnv` (план 1).
- Produces:
  ```ts
  // reserve-messages.ts
  function reserveErrorMessage(reason: Exclude<ReserveResult, { ok: true }>["reason"]): string;
  function cancelErrorMessage(reason: Exclude<CancelResult, { ok: true }>["reason"]): string;
  // actions.ts ("use server")
  function reserveAction(slug: string, itemId: string, prev: FormState, form: FormData): Promise<FormState>;
  function cancelAction(slug: string, itemId: string): Promise<void>;
  // ShareBar.tsx ("use client")
  function ShareBar(props: { url: string; title: string }): JSX.Element;
  // ReserveSheet.tsx ("use client")
  function ReserveSheet(props: { slug: string; itemId: string; itemTitle: string; priceText: string | null; ownerName: string; defaultName: string }): JSX.Element;
  ```
- GET-страница cookie не создаёт (серверный компонент не может ставить cookie); `wl_guest` появляется при первой брони в Server Action.
- Страница: `robots: noindex`, заголовок вкладки — название списка.

- [ ] **Step 1: Тексты ошибок (тест → реализация)**

`apps/web/src/app/[slug]/reserve-messages.test.ts`:
```ts
import { expect, test } from "vitest";
import { cancelErrorMessage, reserveErrorMessage } from "./reserve-messages";

test("every reservation failure has a human message", () => {
  expect(reserveErrorMessage("ALREADY_RESERVED")).toBe("Упс, этот подарок уже забронировали");
  expect(reserveErrorMessage("OWNER_CANNOT_RESERVE")).toBe("Это ваш список — бронировать в нём нельзя");
  expect(reserveErrorMessage("INVALID_NAME")).toBe("Напишите имя — до 40 символов");
  expect(reserveErrorMessage("NOT_FOUND")).toBe("Подарок не найден — возможно, его удалили");
  expect(reserveErrorMessage("NO_IDENTITY")).toBe("Не получилось. Обновите страницу и попробуйте ещё раз");
  expect(cancelErrorMessage("NOT_YOUR_RESERVATION")).toBe("Эту бронь поставил другой человек");
  expect(cancelErrorMessage("NOT_RESERVED")).toBe("Бронь уже снята");
  expect(cancelErrorMessage("NOT_FOUND")).toBe("Подарок не найден — возможно, его удалили");
});
```

Run: `pnpm vitest run "apps/web/src/app/\[slug\]"`
Expected: FAIL — `Cannot find module './reserve-messages'`.

`apps/web/src/app/[slug]/reserve-messages.ts`:
```ts
import type { CancelResult, ReserveResult } from "@wishlist/db";

type ReserveFailure = Exclude<ReserveResult, { ok: true }>["reason"];
type CancelFailure = Exclude<CancelResult, { ok: true }>["reason"];

const NOT_FOUND = "Подарок не найден — возможно, его удалили";

const RESERVE_MESSAGES: Record<ReserveFailure, string> = {
  ALREADY_RESERVED: "Упс, этот подарок уже забронировали",
  OWNER_CANNOT_RESERVE: "Это ваш список — бронировать в нём нельзя",
  INVALID_NAME: "Напишите имя — до 40 символов",
  NOT_FOUND,
  NO_IDENTITY: "Не получилось. Обновите страницу и попробуйте ещё раз",
};

const CANCEL_MESSAGES: Record<CancelFailure, string> = {
  NOT_YOUR_RESERVATION: "Эту бронь поставил другой человек",
  NOT_RESERVED: "Бронь уже снята",
  NOT_FOUND,
};

export function reserveErrorMessage(reason: ReserveFailure): string {
  return RESERVE_MESSAGES[reason];
}

export function cancelErrorMessage(reason: CancelFailure): string {
  return CANCEL_MESSAGES[reason];
}
```

Run: `pnpm vitest run "apps/web/src/app/\[slug\]"`
Expected: PASS.

- [ ] **Step 2: Server Actions**

`apps/web/src/app/[slug]/actions.ts`:
```ts
"use server";

import { cancelReservation, reserveItem } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { reservationLimiter } from "@/server/rate-limit";
import { clientKey, ensureGuestViewer } from "@/server/viewer";
import { errorState, type FormState, LIMIT_MESSAGES, successState } from "../lists/form-state";
import { cancelErrorMessage, reserveErrorMessage } from "./reserve-messages";

export async function reserveAction(slug: string, itemId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { viewer } = await ensureGuestViewer();
  if (!reservationLimiter.allow(await clientKey(viewer))) return errorState({}, LIMIT_MESSAGES.rate);
  const guestName = typeof form.get("guestName") === "string" ? String(form.get("guestName")) : "";
  const result = await reserveItem(getDb(), { slug, itemId, viewer, guestName });
  revalidatePath(`/${slug}`);
  if (!result.ok) {
    const message = reserveErrorMessage(result.reason);
    return result.reason === "INVALID_NAME" ? errorState({ guestName: message }) : errorState({}, message);
  }
  return successState("Готово! Подарок за вами");
}

export async function cancelAction(slug: string, itemId: string): Promise<void> {
  const { viewer } = await ensureGuestViewer();
  if (!reservationLimiter.allow(await clientKey(viewer))) return;
  const result = await cancelReservation(getDb(), { slug, itemId, viewer });
  if (!result.ok) console.warn("cancel reservation failed", cancelErrorMessage(result.reason));
  revalidatePath(`/${slug}`);
}
```

- [ ] **Step 3: Клиентские компоненты**

`apps/web/src/components/ShareBar.tsx`:
```tsx
"use client";

import { useState } from "react";

const COPIED_RESET_MS = 2000;

export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      window.prompt("Скопируйте ссылку", url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // пользователь закрыл системное окно — ничего не делаем
    }
  }

  return (
    <section className="panel stack" aria-label="Поделиться списком">
      <p className="muted" style={{ margin: 0, overflowWrap: "anywhere" }}>{url}</p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button type="button" className="button button--small" onClick={copy}>{copied ? "Скопировано" : "Скопировать ссылку"}</button>
        <a className="button button--ghost button--small" href={telegramUrl} target="_blank" rel="noopener noreferrer">Telegram</a>
        {canNativeShare && <button type="button" className="button button--ghost button--small" onClick={nativeShare}>Ещё…</button>}
      </div>
    </section>
  );
}
```

`apps/web/src/app/[slug]/ReserveSheet.tsx`:
```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../lists/form-state";
import { reserveAction } from "./actions";

type Props = { slug: string; itemId: string; itemTitle: string; priceText: string | null; ownerName: string; defaultName: string };

export function ReserveSheet({ slug, itemId, itemTitle, priceText, ownerName, defaultName }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reserveAction.bind(null, slug, itemId), initialFormState);

  useEffect(() => {
    if (state.status === "success") setOpen(false);
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="button button--small" onClick={() => setOpen(true)}>Я подарю</button>
      {state.status === "error" && state.message && !open && <p className="error" role="status">{state.message}</p>}
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={`sheet-${itemId}`}>
            <div className="row row--between">
              <h2 id={`sheet-${itemId}`} className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>{itemTitle}</h2>
              <button type="button" className="link-button" onClick={() => setOpen(false)} aria-label="Закрыть">✕</button>
            </div>
            {priceText && <p className="serif" style={{ margin: "4px 0 12px" }}>{priceText}</p>}
            <form action={action} className="stack" noValidate>
              <div className="field">
                <label htmlFor={`guest-${itemId}`}>Как вас подписать</label>
                <input id={`guest-${itemId}`} name="guestName" className="input" maxLength={40} defaultValue={defaultName} autoFocus required />
                {state.errors.guestName && <p className="error">{state.errors.guestName}</p>}
              </div>
              <p className="muted" style={{ margin: 0 }}>{ownerName} не узнает, кто дарит</p>
              {state.status === "error" && state.message && <p className="error" role="status">{state.message}</p>}
              <SubmitButton pendingText="Бронируем…">Я подарю</SubmitButton>
            </form>
          </div>
        </>
      )}
    </>
  );
}
```

`apps/web/src/app/[slug]/CancelReservationButton.tsx`:
```tsx
"use client";

import { cancelAction } from "./actions";

export function CancelReservationButton({ slug, itemId }: { slug: string; itemId: string }) {
  return (
    <form
      action={cancelAction.bind(null, slug, itemId)}
      onSubmit={(event) => { if (!window.confirm("Снять бронь? Подарок снова станет свободным.")) event.preventDefault(); }}
    >
      <button type="submit" className="link-button">Снять бронь</button>
    </form>
  );
}
```

- [ ] **Step 4: Публичная страница**

`apps/web/src/app/[slug]/page.tsx`:
```tsx
import { getPublicWishlist, type PublicItemView } from "@wishlist/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountdownSticker } from "@/components/CountdownSticker";
import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/ItemCard";
import { toCardModel } from "@/components/item-card-model";
import { ReservedSticker } from "@/components/ReservedSticker";
import { ShareBar } from "@/components/ShareBar";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { readViewer } from "@/server/viewer";
import { CancelReservationButton } from "./CancelReservationButton";
import { ReserveSheet } from "./ReserveSheet";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { viewer } = await readViewer();
  const view = await getPublicWishlist(getDb(), slug, viewer);
  return { title: view ? `${view.wishlist.title} — вишлист` : "Вишлист", robots: { index: false, follow: false } };
}

function stickerFor(item: PublicItemView) {
  if (item.status === "reserved_by_me") return <ReservedSticker label="вы дарите" />;
  if (item.status === "reserved_by_other") return <ReservedSticker />;
  return undefined;
}

export default async function PublicWishlistPage({ params }: Props) {
  const { slug } = await params;
  const { viewer, user } = await readViewer();
  const view = await getPublicWishlist(getDb(), slug, viewer);
  if (!view) notFound();
  const { wishlist, items, ownerName, isOwner } = view;
  const shareUrl = new URL(`/${wishlist.slug}`, getEnv().APP_URL).toString();
  const defaultName = user?.displayName.split(" ")[0] ?? "";

  return (
    <main className="page page--wide">
      <div className="row row--between">
        <p className="eyebrow">список {ownerName}</p>
        <CountdownSticker occasion={wishlist.occasion} eventDate={wishlist.eventDate} />
      </div>
      <h1 className="display">{wishlist.title}</h1>

      {isOwner && (
        <p className="panel muted" style={{ marginBottom: 20 }}>
          Это ваш список — так его видят гости. <Link href={`/lists/${wishlist.id}`}>Редактировать</Link>
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState title="Пока пусто" text={`${ownerName} ещё не добавил(а) подарки. Загляните позже.`} />
      ) : (
        <section className="grid" aria-label="Подарки">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} dimmed={item.status === "reserved_by_other"} sticker={stickerFor(item)}>
              {!isOwner && item.status === "free" && (
                <ReserveSheet
                  slug={wishlist.slug}
                  itemId={item.id}
                  itemTitle={item.title}
                  priceText={toCardModel(item).priceText}
                  ownerName={ownerName}
                  defaultName={defaultName}
                />
              )}
              {!isOwner && item.status === "reserved_by_me" && <CancelReservationButton slug={wishlist.slug} itemId={item.id} />}
            </ItemCard>
          ))}
        </section>
      )}

      <div style={{ marginTop: 32 }}>
        <ShareBar url={shareUrl} title={`${wishlist.title} — вишлист`} />
      </div>
    </main>
  );
}
```

Порядок маршрутов: статические сегменты (`/login`, `/me`, `/tg`, `/lists`, `/api`) имеют приоритет над `/[slug]`; `getPublicWishlist` отбрасывает всё, что не похоже на slug из 10 символов, поэтому `/favicon.ico` и прочие адреса дают 404 без запроса к БД.

- [ ] **Step 5: ShareBar на странице владельца**

В `apps/web/src/app/lists/[id]/page.tsx`:
1. Добавить импорты `import { ShareBar } from "@/components/ShareBar";` и `import { getEnv } from "@/server/env";`.
2. После строки `const { wishlist, items, surpriseMode } = view;` добавить:
```tsx
  const shareUrl = new URL(`/${wishlist.slug}`, getEnv().APP_URL).toString();
```
3. Сразу после блока с кнопкой «Как видят гости» (перед `<AddItemForm …/>`) вставить:
```tsx
      <div style={{ marginBottom: 20 }}>
        <ShareBar url={shareUrl} title={`${wishlist.title} — вишлист`} />
      </div>
```

- [ ] **Step 6: Проверка**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS, в маршрутах есть `ƒ /[slug]`.

Ручная проверка локально (`pnpm dev:db` + `pnpm dev:web`):
1. Войти `…/api/dev/login?name=Маша`, открыть список с 2 подарками, нажать «Скопировать ссылку».
2. Открыть ссылку в **окне инкогнито** → «список Маша», у подарков кнопки «Я подарю».
3. «Я подарю» → ввести «Аня» → «Я подарю» → окно закрылось, у подарка стикер «вы дарите» и «Снять бронь».
4. В обычном окне (Маша) обновить страницу списка → у подарка стикер «забронировано», имени «Аня» нигде нет (проверить исходный код страницы: `Ctrl+U`, поиск «Аня» → не найдено).
5. Второе инкогнито-окно (другой браузер) → тот же подарок со стикером «занято», без кнопки.
6. В первом инкогнито «Снять бронь» → подтверждение → подарок снова свободен.
7. Маша открывает свою публичную ссылку → плашка «Это ваш список», кнопок брони нет.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): public wishlist page with guest reservations and sharing"
```

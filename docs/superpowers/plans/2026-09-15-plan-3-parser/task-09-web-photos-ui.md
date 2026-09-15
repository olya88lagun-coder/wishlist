# Task 9: Web — фото в карточках, скелетон, опрос статуса, подсказки

**Files:**
- Create: `apps/web/src/components/item-image.ts`, `apps/web/src/app/lists/[id]/parse-hint.ts`, `apps/web/src/app/lists/[id]/PendingRefresher.tsx`
- Modify: `apps/web/src/server/env.ts`, `apps/web/src/components/item-card-model.ts`, `apps/web/src/components/StoreTile.tsx`, `apps/web/src/components/ItemCard.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/lists/[id]/page.tsx`, `apps/web/src/app/[slug]/page.tsx`, `apps/web/.env.development.example`
- Test: `apps/web/src/components/item-image.test.ts`, `apps/web/src/components/item-card-model.test.ts` (изменение), `apps/web/src/app/lists/[id]/parse-hint.test.ts`

**Interfaces:**
- Consumes: `OwnerItemView` c `imageKey`, `parseStatus`; `PublicItemView` с `imageKey` (Task 5); `QuickLinkForm` (Task 8); `detectStore` из `@wishlist/core`; `ItemParseStatus` из `@wishlist/db`.
- Produces:
  ```ts
  // server/env.ts: AppEnv.S3_PUBLIC_BASE_URL?: string
  // components/item-image.ts
  function imageUrlFor(imageKey: string | null, publicBaseUrl: string | undefined): string | null;
  // components/item-card-model.ts
  type CardItem = { title: string; sourceUrl: string | null; priceKopecks: number | null; note: string | null; isMustHave: boolean; imageUrl?: string | null; parseStatus?: ItemParseStatus };
  type CardModel = { ...прежние поля; imageUrl: string | null; pending: boolean };
  // app/lists/[id]/parse-hint.ts
  function parseHint(item: { parseStatus: ItemParseStatus; title: string; priceKopecks: number | null; sourceUrl: string | null }): string | null;
  // PendingRefresher.tsx ("use client")
  const POLL_INTERVAL_MS = 2000; const MAX_POLL_MS = 90_000;
  function PendingRefresher(props: { pendingCount: number }): JSX.Element | null;
  ```
- Опрос — `router.refresh()` раз в 2 с, пока на странице есть `pending`, не дольше 90 с (спека 3.2). Отдельного API статуса нет: серверный компонент перечитывает список.

- [ ] **Step 1: URL фото (тест → реализация)**

`apps/web/src/components/item-image.test.ts`:
```ts
import { expect, test } from "vitest";
import { imageUrlFor } from "./item-image";

test("joins the public bucket URL and the object key", () => {
  expect(imageUrlFor("items/abc/1.webp", "https://s3.twcstorage.ru/wishlist-images")).toBe("https://s3.twcstorage.ru/wishlist-images/items/abc/1.webp");
  expect(imageUrlFor("items/abc/1.webp", "https://s3.twcstorage.ru/wishlist-images/")).toBe("https://s3.twcstorage.ru/wishlist-images/items/abc/1.webp");
});

test("no key or no configured bucket means no photo", () => {
  expect(imageUrlFor(null, "https://s3.twcstorage.ru/wishlist-images")).toBeNull();
  expect(imageUrlFor("items/abc/1.webp", undefined)).toBeNull();
});
```

Run: `pnpm vitest run apps/web/src/components/item-image.test.ts`
Expected: FAIL — `Cannot find module './item-image'`.

`apps/web/src/components/item-image.ts`:
```ts
export function imageUrlFor(imageKey: string | null, publicBaseUrl: string | undefined): string | null {
  if (!imageKey || !publicBaseUrl) return null;
  const path = imageKey.split("/").map(encodeURIComponent).join("/");
  return `${publicBaseUrl.replace(/\/+$/, "")}/${path}`;
}
```

Run: `pnpm vitest run apps/web/src/components/item-image.test.ts`
Expected: PASS.

В `apps/web/src/server/env.ts` в `envSchema` добавить поле:
```ts
  S3_PUBLIC_BASE_URL: z.url().optional(),
```

- [ ] **Step 2: Модель карточки (тест → реализация)**

`apps/web/src/components/item-card-model.test.ts` заменить целиком:
```ts
import { describe, expect, test } from "vitest";
import { toCardModel } from "./item-card-model";

describe("toCardModel", () => {
  test("formats price, detects store and builds a monogram", () => {
    expect(
      toCardModel({
        title: "наушники Sony",
        sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx",
        priceKopecks: 2499000,
        note: "чёрные",
        isMustHave: true,
        imageUrl: "https://s3.twcstorage.ru/wishlist-images/items/1/a.webp",
        parseStatus: "ok",
      }),
    ).toEqual({
      title: "наушники Sony",
      priceText: "24 990 ₽",
      storeLabel: "Wildberries",
      monogram: "Н",
      note: "чёрные",
      isMustHave: true,
      href: "https://www.wildberries.ru/catalog/1/detail.aspx",
      imageUrl: "https://s3.twcstorage.ru/wishlist-images/items/1/a.webp",
      pending: false,
    });
  });

  test("works without link, price, photo and status", () => {
    expect(toCardModel({ title: "  сертификат", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false })).toMatchObject({
      priceText: null,
      storeLabel: null,
      monogram: "С",
      href: null,
      imageUrl: null,
      pending: false,
    });
  });

  test("an item still being parsed shows a loading title and the store monogram", () => {
    expect(
      toCardModel({ title: "", sourceUrl: "https://goldapple.ru/19000180719-lip-mask", priceKopecks: null, note: null, isMustHave: false, parseStatus: "pending" }),
    ).toMatchObject({ title: "Загружаем данные…", monogram: "З", storeLabel: "Золотое Яблоко", pending: true });
  });

  test("an item the store gave nothing for is named by its store", () => {
    expect(
      toCardModel({ title: "", sourceUrl: "https://www.ozon.ru/t/abc", priceKopecks: null, note: null, isMustHave: false, parseStatus: "failed" }),
    ).toMatchObject({ title: "Подарок из Ozon", monogram: "O", pending: false });
  });
});
```

Run: `pnpm vitest run apps/web/src/components/item-card-model.test.ts`
Expected: FAIL — нет полей `imageUrl`, `pending`.

`apps/web/src/components/item-card-model.ts` заменить целиком:
```ts
import { detectStore, formatKopecks } from "@wishlist/core";
import type { ItemParseStatus } from "@wishlist/db";

export type CardItem = {
  title: string;
  sourceUrl: string | null;
  priceKopecks: number | null;
  note: string | null;
  isMustHave: boolean;
  imageUrl?: string | null;
  parseStatus?: ItemParseStatus;
};

export type CardModel = {
  title: string;
  priceText: string | null;
  storeLabel: string | null;
  monogram: string;
  note: string | null;
  isMustHave: boolean;
  href: string | null;
  imageUrl: string | null;
  pending: boolean;
};

function displayTitle(title: string, storeLabel: string | null, pending: boolean): string {
  if (title.trim() !== "") return title;
  if (pending) return "Загружаем данные…";
  return storeLabel ? `Подарок из ${storeLabel}` : "Подарок";
}

export function toCardModel(item: CardItem): CardModel {
  const storeLabel = item.sourceUrl ? detectStore(item.sourceUrl).label : null;
  const pending = item.parseStatus === "pending";
  const title = displayTitle(item.title, storeLabel, pending);
  // Пока названия нет, монограмма — первая буква магазина, а не служебного текста «Загружаем…»
  const monogramSource = item.title.trim() !== "" ? item.title : (storeLabel ?? title);
  return {
    title,
    priceText: item.priceKopecks === null ? null : formatKopecks(item.priceKopecks),
    storeLabel,
    monogram: (monogramSource.trim()[0] ?? "?").toLocaleUpperCase("ru-RU"),
    note: item.note,
    isMustHave: item.isMustHave,
    href: item.sourceUrl,
    imageUrl: item.imageUrl ?? null,
    pending,
  };
}
```

Run: `pnpm vitest run apps/web/src/components/item-card-model.test.ts`
Expected: PASS.

- [ ] **Step 3: Подсказка «впишите недостающее» (тест → реализация)**

`apps/web/src/app/lists/[id]/parse-hint.test.ts`:
```ts
import { expect, test } from "vitest";
import { parseHint } from "./parse-hint";

const base = { title: "Наушники", priceKopecks: 199000, sourceUrl: "https://market.yandex.ru/product--x/1" };

test("asks only for what the store did not give", () => {
  expect(parseHint({ ...base, parseStatus: "partial", priceKopecks: null })).toBe("Яндекс Маркет не отдал цену — впишите её");
  expect(parseHint({ ...base, parseStatus: "failed", title: "", priceKopecks: null })).toBe("Яндекс Маркет не отдал данные — впишите название и цену");
  expect(parseHint({ ...base, parseStatus: "failed", title: "", sourceUrl: null })).toBe("Магазин не отдал данные — впишите название");
});

test("no hint for complete, pending or manual items", () => {
  expect(parseHint({ ...base, parseStatus: "ok" })).toBeNull();
  expect(parseHint({ ...base, parseStatus: "pending", title: "" })).toBeNull();
  expect(parseHint({ ...base, parseStatus: "partial" })).toBeNull();
});
```

Run: `pnpm vitest run "apps/web/src/app/lists/\[id\]/parse-hint.test.ts"`
Expected: FAIL — `Cannot find module './parse-hint'`.

`apps/web/src/app/lists/[id]/parse-hint.ts`:
```ts
import { detectStore } from "@wishlist/core";
import type { ItemParseStatus } from "@wishlist/db";

type HintItem = { parseStatus: ItemParseStatus; title: string; priceKopecks: number | null; sourceUrl: string | null };

export function parseHint(item: HintItem): string | null {
  if (item.parseStatus !== "partial" && item.parseStatus !== "failed") return null;
  const store = item.sourceUrl ? detectStore(item.sourceUrl).label : "Магазин";
  const missing = [item.title === "" ? "название" : null, item.priceKopecks === null ? "цену" : null].filter((field) => field !== null);
  if (missing.length === 0) return null;
  if (missing.length === 1 && missing[0] === "цену") return `${store} не отдал цену — впишите её`;
  return `${store} не отдал данные — впишите ${missing.join(" и ")}`;
}
```

Run: `pnpm vitest run "apps/web/src/app/lists/\[id\]/parse-hint.test.ts"`
Expected: PASS.

- [ ] **Step 4: Фото и скелетон в карточке**

`apps/web/src/components/StoreTile.tsx` заменить целиком:
```tsx
export function StoreTile({ monogram, storeLabel, isMustHave, imageUrl, pending }: {
  monogram: string;
  storeLabel: string | null;
  isMustHave?: boolean;
  imageUrl?: string | null;
  pending?: boolean;
}) {
  return (
    <div className={pending ? "tile tile--loading" : "tile"} aria-hidden="true">
      {imageUrl ? (
        // Фото уже сжаты воркером в WebP 800px; next/image не нужен и не тратит память web-контейнера
        <img className="tile__img" src={imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : (
        <span className="tile__monogram">{monogram}</span>
      )}
      {storeLabel && <span className="tile__store">{storeLabel}</span>}
      {isMustHave && <span className="tile__heart">♥</span>}
    </div>
  );
}
```

В `apps/web/src/components/ItemCard.tsx` строку
```tsx
      <StoreTile monogram={card.monogram} storeLabel={card.storeLabel} isMustHave={card.isMustHave} />
```
заменить на
```tsx
      <StoreTile monogram={card.monogram} storeLabel={card.storeLabel} isMustHave={card.isMustHave} imageUrl={card.imageUrl} pending={card.pending} />
```
и `<article className={dimmed ? "card card--dimmed" : "card"}>` — на
```tsx
    <article className={dimmed ? "card card--dimmed" : "card"} aria-busy={card.pending}>
```

В конец `apps/web/src/app/globals.css`:
```css
.tile__img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.tile__img + .tile__store { background: rgb(246 241 231 / 0.85); padding: 2px 6px; border-radius: 4px; }
.tile--loading { background: linear-gradient(100deg, var(--paper-deep) 30%, var(--card) 50%, var(--paper-deep) 70%); background-size: 200% 100%; animation: tile-shimmer 1.4s ease-in-out infinite; }
@keyframes tile-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) { .tile--loading { animation: none; } }
.card__hint { font-size: 12px; color: var(--pink); margin: 0; }
.quick-link__row { display: flex; gap: 8px; flex-wrap: wrap; }
.quick-link__row .input { flex: 1 1 220px; }
.quick-link__row .button { flex: 0 0 auto; width: auto; }
```

- [ ] **Step 5: Опрос, пока есть незаполненные карточки**

`apps/web/src/app/lists/[id]/PendingRefresher.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const POLL_INTERVAL_MS = 2000;
export const MAX_POLL_MS = 90_000;

export function PendingRefresher({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (pendingCount === 0) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingCount, router]);

  if (pendingCount === 0 || !gaveUp) return null;
  return (
    <p className="muted" role="status">
      Магазин долго не отвечает. Заполните подарок вручную через «Изменить» — данные из магазина подтянутся, если он ответит позже.
    </p>
  );
}
```

- [ ] **Step 6: Страница списка владельца**

В `apps/web/src/app/lists/[id]/page.tsx`:

1. Добавить импорты:
```tsx
import { imageUrlFor } from "@/components/item-image";
import { parseHint } from "./parse-hint";
import { PendingRefresher } from "./PendingRefresher";
import { QuickLinkForm } from "./QuickLinkForm";
```
2. После `const shareUrl = ...` добавить:
```tsx
  const publicBaseUrl = getEnv().S3_PUBLIC_BASE_URL;
  const pendingCount = items.filter((item) => item.parseStatus === "pending").length;
```
3. Строку `<AddItemForm wishlistId={wishlist.id} defaultOpen={items.length === 0} />` заменить на:
```tsx
      <QuickLinkForm wishlistId={wishlist.id} />
      <AddItemForm wishlistId={wishlist.id} defaultOpen={false} />
      <PendingRefresher pendingCount={pendingCount} />
```
4. Текст пустого состояния заменить: `text="Вставьте ссылку из любого магазина — название, фото и цену подтянем сами."`.
5. Цикл карточек заменить на:
```tsx
          {items.map((item) => {
            const hint = parseHint(item);
            return (
              <ItemCard
                key={item.id}
                item={{ ...item, imageUrl: imageUrlFor(item.imageKey, publicBaseUrl) }}
                dimmed={item.reserved}
                sticker={item.reserved ? <ReservedSticker label="забронировано" /> : undefined}
              >
                {hint && <p className="card__hint">{hint}</p>}
                <ItemEditor wishlistId={wishlist.id} itemId={item.id} defaults={editorDefaults(item)} />
                <ConfirmButton action={deleteItemAction.bind(null, wishlist.id, item.id)} question={`Удалить «${item.title || "подарок"}»?`}>
                  Удалить
                </ConfirmButton>
              </ItemCard>
            );
          })}
```

В `apps/web/src/app/lists/[id]/AddItemForm.tsx` текст `summary` «Добавить подарок» заменить на «Добавить без ссылки или со всеми полями».

- [ ] **Step 7: Публичная страница**

В `apps/web/src/app/[slug]/page.tsx`:
1. Импорт `import { imageUrlFor } from "@/components/item-image";`.
2. После `const shareUrl = ...` добавить `const publicBaseUrl = getEnv().S3_PUBLIC_BASE_URL;`.
3. В `<ItemCard key={item.id} item={item} ...>` заменить `item={item}` на `item={{ ...item, imageUrl: imageUrlFor(item.imageKey, publicBaseUrl) }}`.

- [ ] **Step 8: Проверка локально**

`apps/web/.env.development.example` не меняется (без S3 карточки показывают монограмму).

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS.

Ручная проверка (терминал 1: `pnpm dev:db`, терминал 2: `pnpm dev:web`, терминал 3: `pnpm dev:worker`), вход `http://localhost:3000/api/dev/login?name=Маша`:
1. Список → форма «Вставьте ссылку на подарок» вверху. Вставить `https://www.ozon.ru/product/dyuna-frenk-gerbert-1234567/` → «Добавить» → карточка со скелетоном «Загружаем данные…» → в течение нескольких секунд без перезагрузки: «Dyuna frenk gerbert», подсказка «Ozon не отдал цену — впишите её».
2. «Изменить» → вписать цену → «Сохранить» → подсказка исчезла.
3. Отправить пустую форму ссылки → «Вставьте ссылку или напишите название».
4. Вставить `http://127.0.0.1:3000/` → карточка становится «Подарок из 127.0.0.1» с подсказкой «127.0.0.1 не отдал данные — впишите название и цену» (SSRF-защита: воркер не пошёл на локальный адрес; в логе воркера `item parsed ... status: failed`).
5. Остановить воркер, вставить любую ссылку → через 90 с сообщение «Магазин долго не отвечает…». Запустить воркер → карточка заполнится после обновления страницы.
6. Скопировать ссылку `https://www.ozon.ru/product/nabor-kistey-12-sht-987654321/`, кликнуть по пустому месту страницы списка и нажать Ctrl+V → подарок добавился без ввода в поле.
7. Публичная страница списка в окне без входа: подарки без названия в статусе `pending` не видны.

Магазины из РФ (WB, Золотое Яблоко) с машины разработчика отдают антибот — их проверка только на проде (Task 11).

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): product photos, loading skeleton, status polling and fill-in hints"
```

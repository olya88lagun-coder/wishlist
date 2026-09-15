# Task 7: Стили и общие компоненты «Журнала» (`apps/web`)

**Files:**
- Modify: `apps/web/src/app/globals.css` (полная замена)
- Create: `apps/web/src/components/StoreTile.tsx`, `CountdownSticker.tsx`, `ReservedSticker.tsx`, `ItemCard.tsx`, `EmptyState.tsx`, `SubmitButton.tsx`
- Test: `apps/web/src/components/item-card-model.test.ts`
- Create: `apps/web/src/components/item-card-model.ts`

**Interfaces:**
- Consumes: `detectStore`, `formatKopecks`, `daysUntil`, `countdownLabel`, `Occasion` (core).
- Produces:
  ```ts
  // item-card-model.ts (чистая функция, тестируется)
  type CardItem = { title: string; sourceUrl: string | null; priceKopecks: number | null; note: string | null; isMustHave: boolean };
  type CardModel = { title: string; priceText: string | null; storeLabel: string | null; monogram: string; note: string | null; isMustHave: boolean; href: string | null };
  function toCardModel(item: CardItem): CardModel;
  // Компоненты (серверные, кроме SubmitButton)
  function StoreTile(props: { monogram: string; storeLabel: string | null }): JSX.Element;
  function CountdownSticker(props: { occasion: Occasion; eventDate: string | null; now?: Date }): JSX.Element | null;
  function ReservedSticker(props: { label?: string }): JSX.Element;              // по умолчанию «занято»
  function ItemCard(props: { item: CardItem; sticker?: ReactNode; dimmed?: boolean; children?: ReactNode }): JSX.Element;
  function EmptyState(props: { title: string; text: string; children?: ReactNode }): JSX.Element;
  function SubmitButton(props: { children: ReactNode; pendingText: string; variant?: "primary" | "ghost" }): JSX.Element;  // "use client"
  ```
- **Важно:** `@wishlist/core` использует `node:crypto`, поэтому импортировать его можно только в серверных компонентах и server actions. Клиентские компоненты (`"use client"`) получают уже готовые строки через props.

- [x] **Step 1: Падающий тест модели карточки**

`apps/web/src/components/item-card-model.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { toCardModel } from "./item-card-model";

describe("toCardModel", () => {
  test("formats price, detects store and builds a monogram", () => {
    expect(
      toCardModel({ title: "наушники Sony", sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx", priceKopecks: 2499000, note: "чёрные", isMustHave: true }),
    ).toEqual({
      title: "наушники Sony",
      priceText: "24 990 ₽",
      storeLabel: "Wildberries",
      monogram: "Н",
      note: "чёрные",
      isMustHave: true,
      href: "https://www.wildberries.ru/catalog/1/detail.aspx",
    });
  });

  test("works without link and price", () => {
    expect(toCardModel({ title: "  сертификат", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false })).toMatchObject({
      priceText: null,
      storeLabel: null,
      monogram: "С",
      href: null,
    });
  });
});
```

Run: `pnpm vitest run apps/web/src/components`
Expected: FAIL — `Cannot find module './item-card-model'`.

- [x] **Step 2: Модель карточки**

`apps/web/src/components/item-card-model.ts`:
```ts
import { detectStore, formatKopecks } from "@wishlist/core";

export type CardItem = { title: string; sourceUrl: string | null; priceKopecks: number | null; note: string | null; isMustHave: boolean };
export type CardModel = {
  title: string;
  priceText: string | null;
  storeLabel: string | null;
  monogram: string;
  note: string | null;
  isMustHave: boolean;
  href: string | null;
};

export function toCardModel(item: CardItem): CardModel {
  return {
    title: item.title,
    priceText: item.priceKopecks === null ? null : formatKopecks(item.priceKopecks),
    storeLabel: item.sourceUrl ? detectStore(item.sourceUrl).label : null,
    monogram: (item.title.trim()[0] ?? "?").toLocaleUpperCase("ru-RU"),
    note: item.note,
    isMustHave: item.isMustHave,
    href: item.sourceUrl,
  };
}
```

Run: `pnpm vitest run apps/web/src/components`
Expected: PASS.

- [x] **Step 3: Стили**

`apps/web/src/app/globals.css` (заменить целиком):
```css
:root {
  --paper: #f6f1e7;
  --paper-deep: #ede7da;
  --ink: #2c2c2a;
  --ink-soft: #5f5e5a;
  --ink-faint: #888780;
  --line: #d3d1c7;
  --pink: #d4537e;
  --pink-ink: #ffffff;
  --yellow: #ffe66d;
  --danger: #a32d2d;
  --card: #fffdf8;
  --radius: 14px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #1f1f1d;
    --paper-deep: #2a2a27;
    --ink: #f1efe8;
    --ink-soft: #b4b2a9;
    --ink-faint: #888780;
    --line: #444441;
    --card: #2c2c2a;
  }
}

* { box-sizing: border-box; }
html, body { margin: 0; background: var(--paper); color: var(--ink); }
body { font-family: var(--font-manrope), system-ui, sans-serif; font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
a { color: inherit; }

.page { max-width: 560px; margin: 0 auto; padding: 28px 18px 120px; }
@media (min-width: 900px) { .page--wide { max-width: 1040px; } }

.eyebrow { font-size: 12px; letter-spacing: 0.04em; color: var(--ink-soft); margin: 0; }
.display { font-family: var(--font-playfair), Georgia, serif; font-weight: 500; font-size: clamp(34px, 9vw, 52px); line-height: 1.02; margin: 6px 0 20px; }
.display i { font-style: italic; }
.serif { font-family: var(--font-playfair), Georgia, serif; }
.muted { color: var(--ink-soft); font-size: 14px; }
.error { color: var(--danger); font-size: 13px; margin: 4px 0 0; }

.row { display: flex; align-items: center; gap: 10px; }
.row--between { justify-content: space-between; }
.stack { display: grid; gap: 12px; }

.button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 22px; border-radius: 999px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); font: inherit; font-weight: 500; text-decoration: none; cursor: pointer; }
.button--block { width: 100%; }
.button--ghost { background: transparent; color: var(--ink); }
.button--small { min-height: 34px; padding: 0 14px; font-size: 14px; }
.button:disabled { opacity: 0.6; cursor: progress; }
.link-button { background: none; border: 0; padding: 0; font: inherit; color: var(--ink-soft); text-decoration: underline; cursor: pointer; }
.link-button--danger { color: var(--danger); }

.field { display: grid; gap: 4px; }
.field label { font-size: 13px; color: var(--ink-soft); }
.input, .select, .textarea { width: 100%; min-height: 44px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); font: inherit; }
.textarea { min-height: 72px; resize: vertical; }
.input:focus-visible, .select:focus-visible, .textarea:focus-visible, .button:focus-visible { outline: 2px solid var(--pink); outline-offset: 2px; }
.checkbox { display: flex; gap: 8px; align-items: center; font-size: 14px; }

.panel { background: var(--card); border-radius: var(--radius); padding: 16px; }

.sticker { display: inline-block; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
.sticker--countdown { background: var(--ink); color: var(--yellow); transform: rotate(-3deg); }
.sticker--reserved { background: var(--pink); color: var(--pink-ink); transform: rotate(8deg); animation: slap 280ms cubic-bezier(0.2, 1.6, 0.4, 1); }
@keyframes slap { from { transform: scale(1.8) rotate(-12deg); opacity: 0; } to { transform: scale(1) rotate(8deg); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .sticker--reserved { animation: none; } }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; }
@media (min-width: 900px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

.card { position: relative; display: grid; gap: 6px; align-content: start; }
.card--dimmed .tile { opacity: 0.55; }
.card__sticker { position: absolute; right: -4px; top: -8px; z-index: 1; }
.card__title { font-size: 14px; margin: 2px 0 0; overflow-wrap: anywhere; }
.card__price { font-family: var(--font-playfair), Georgia, serif; font-size: 15px; margin: 0; }
.card__meta { font-size: 12px; color: var(--ink-faint); margin: 0; }
.card__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }

.tile { aspect-ratio: 4 / 5; border-radius: 6px; background: var(--paper-deep); display: grid; place-items: center; position: relative; overflow: hidden; }
.tile__monogram { font-family: var(--font-playfair), Georgia, serif; font-style: italic; font-size: 64px; color: var(--ink-faint); }
.tile__store { position: absolute; left: 8px; bottom: 8px; font-size: 11px; color: var(--ink-soft); }
.tile__heart { position: absolute; right: 8px; top: 8px; font-size: 14px; color: var(--pink); }

.list-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--line); text-decoration: none; }
.list-row__title { font-family: var(--font-playfair), Georgia, serif; font-size: 22px; margin: 0; }

.sheet-backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.35); z-index: 20; }
.sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 21; background: var(--card); border-radius: 18px 18px 0 0; padding: 18px 18px calc(18px + env(safe-area-inset-bottom)); max-width: 560px; margin: 0 auto; }

.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 18px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--paper) 30%); }
.bottom-bar__inner { max-width: 560px; margin: 0 auto; }

.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [x] **Step 4: Компоненты**

`apps/web/src/components/StoreTile.tsx`:
```tsx
export function StoreTile({ monogram, storeLabel, isMustHave }: { monogram: string; storeLabel: string | null; isMustHave?: boolean }) {
  return (
    <div className="tile" aria-hidden="true">
      <span className="tile__monogram">{monogram}</span>
      {storeLabel && <span className="tile__store">{storeLabel}</span>}
      {isMustHave && <span className="tile__heart">♥</span>}
    </div>
  );
}
```

`apps/web/src/components/CountdownSticker.tsx`:
```tsx
import { countdownLabel, daysUntil, type Occasion } from "@wishlist/core";

export function CountdownSticker({ occasion, eventDate, now = new Date() }: { occasion: Occasion; eventDate: string | null; now?: Date }) {
  const days = daysUntil(eventDate, now);
  if (days === null) return null;
  return <span className="sticker sticker--countdown">{countdownLabel(occasion, days)}</span>;
}
```

`apps/web/src/components/ReservedSticker.tsx`:
```tsx
export function ReservedSticker({ label = "занято" }: { label?: string }) {
  return <span className="sticker sticker--reserved">{label}</span>;
}
```

`apps/web/src/components/ItemCard.tsx`:
```tsx
import type { ReactNode } from "react";
import { type CardItem, toCardModel } from "./item-card-model";
import { StoreTile } from "./StoreTile";

export function ItemCard({ item, sticker, dimmed, children }: { item: CardItem; sticker?: ReactNode; dimmed?: boolean; children?: ReactNode }) {
  const card = toCardModel(item);
  return (
    <article className={dimmed ? "card card--dimmed" : "card"}>
      {sticker && <div className="card__sticker">{sticker}</div>}
      <StoreTile monogram={card.monogram} storeLabel={card.storeLabel} isMustHave={card.isMustHave} />
      <h3 className="card__title">
        {card.title}
        {card.isMustHave && <span className="visually-hidden"> — очень хочу</span>}
      </h3>
      {card.priceText && <p className="card__price">{card.priceText}</p>}
      {card.note && <p className="card__meta">{card.note}</p>}
      {card.href && (
        <a className="card__meta" href={card.href} target="_blank" rel="noopener noreferrer nofollow">
          Открыть в магазине ↗
        </a>
      )}
      {children && <div className="card__actions">{children}</div>}
    </article>
  );
}
```

`apps/web/src/components/EmptyState.tsx`:
```tsx
import type { ReactNode } from "react";

export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <section className="panel stack" style={{ textAlign: "center", padding: "28px 18px" }}>
      <h2 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 500 }}>{title}</h2>
      <p className="muted" style={{ margin: 0 }}>{text}</p>
      {children}
    </section>
  );
}
```

`apps/web/src/components/SubmitButton.tsx`:
```tsx
"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, variant = "primary" }: { children: ReactNode; pendingText: string; variant?: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  const className = variant === "ghost" ? "button button--ghost button--block" : "button button--block";
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
```

- [x] **Step 5: Проверка**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS, сборка успешна (компоненты пока не используются страницами — это нормально).

- [x] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): journal design tokens and shared UI components"
```

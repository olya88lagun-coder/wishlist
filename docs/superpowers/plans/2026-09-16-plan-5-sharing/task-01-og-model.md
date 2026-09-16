# Task 1: Данные для превью списка

**Files:**
- Create: `apps/web/src/app/[slug]/og-model.ts`
- Test: `apps/web/src/app/[slug]/og-model.test.ts`

**Interfaces:**
- Consumes: `PublicWishlistView` из `@wishlist/db`; `countdownLabel`, `daysUntil`, `pluralRu` из `@wishlist/core`.
- Produces:
  ```ts
  type OgModel = { eyebrow: string; title: string; items: string; countdown: string | null };
  function ogModel(view: Pick<PublicWishlistView, "wishlist" | "ownerName" | "items">, now: Date): OgModel;
  const OG_TITLE_MAX = 60;
  ```

Картинка превью — 1200×630, поэтому длинные названия обрезаются: до 60 символов по границе слова с многоточием. Числительные склоняются.

- [ ] **Step 1: Ветка**

```bash
git checkout master && git pull --ff-only && git checkout -b feat/sharing && git status --short
```
Expected: ветка создана, рабочее дерево чистое.

- [ ] **Step 2: Тест (падает)**

`apps/web/src/app/[slug]/og-model.test.ts`:
```ts
import type { PublicWishlistView } from "@wishlist/db";
import { expect, test } from "vitest";
import { OG_TITLE_MAX, ogModel } from "./og-model";

const NOW = new Date("2026-10-01T09:00:00Z");

const view = (over: Partial<PublicWishlistView> = {}): Pick<PublicWishlistView, "wishlist" | "ownerName" | "items"> => ({
  wishlist: { id: "w1", title: "Маше 30", occasion: "birthday", eventDate: "2026-10-08", slug: "AbCdEfGhIj" },
  ownerName: "Маша",
  items: [],
  ...over,
});

test("describes the list the way the page does", () => {
  const model = ogModel(view({ items: Array.from({ length: 3 }) as PublicWishlistView["items"] }), NOW);
  expect(model).toEqual({ eyebrow: "список Маши", title: "Маше 30", items: "3 подарка", countdown: "ДР через 7 дней" });
});

test("counts gifts and days in Russian", () => {
  expect(ogModel(view(), NOW).items).toBe("пока без подарков");
  expect(ogModel(view({ items: Array.from({ length: 1 }) as PublicWishlistView["items"] }), NOW).items).toBe("1 подарок");
  expect(ogModel(view({ items: Array.from({ length: 11 }) as PublicWishlistView["items"] }), NOW).items).toBe("11 подарков");
  expect(ogModel(view({ wishlist: { ...view().wishlist, occasion: "new_year", eventDate: "2026-10-02" } }), NOW).countdown).toBe("Новый год завтра");
});

test("no date and past dates leave the countdown out", () => {
  expect(ogModel(view({ wishlist: { ...view().wishlist, eventDate: null } }), NOW).countdown).toBeNull();
  expect(ogModel(view({ wishlist: { ...view().wishlist, eventDate: "2026-09-30" } }), NOW).countdown).toBeNull();
});

test("long titles are cut on a word boundary and owner names keep the genitive", () => {
  const long = "Очень длинное название списка про большой семейный праздник и много гостей";
  const model = ogModel(view({ wishlist: { ...view().wishlist, title: long }, ownerName: "Оля" }), NOW);
  expect(model.title.length).toBeLessThanOrEqual(OG_TITLE_MAX + 1);
  expect(model.title.endsWith("…")).toBe(true);
  expect(model.title).not.toContain("  ");
  expect(model.eyebrow).toBe("список Оли");
});
```

Склонение имени: «Маша» → «Маши», «Оля» → «Оли», «Пётр» → «Петра» — полноценная морфология не нужна, достаточно правила для имён на `-а/-я` и общего «список: Пётр» для остальных (см. Step 3, там же тест на мужское имя добавляется).

- [ ] **Step 3: Реализация**

`apps/web/src/app/[slug]/og-model.ts`:
```ts
import { countdownLabel, daysUntil, pluralRu } from "@wishlist/core";
import type { PublicWishlistView } from "@wishlist/db";

export const OG_TITLE_MAX = 60;
const GIFT_FORMS = ["подарок", "подарка", "подарков"] as const;

export type OgModel = { eyebrow: string; title: string; items: string; countdown: string | null };

// Родительный падеж для имён на -а/-я («список Маши»); остальные имена показываем через двоеточие
function ownerEyebrow(ownerName: string): string {
  if (/[ая]$/i.test(ownerName)) return `список ${ownerName.slice(0, -1)}и`;
  return `список: ${ownerName}`;
}

function cut(title: string, max: number): string {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const head = trimmed.slice(0, max);
  const lastSpace = head.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? head.slice(0, lastSpace) : head).trimEnd()}…`;
}

export function ogModel(view: Pick<PublicWishlistView, "wishlist" | "ownerName" | "items">, now: Date): OgModel {
  const count = view.items.length;
  const days = daysUntil(view.wishlist.eventDate, now);
  return {
    eyebrow: ownerEyebrow(view.ownerName),
    title: cut(view.wishlist.title, OG_TITLE_MAX),
    items: count === 0 ? "пока без подарков" : `${count} ${pluralRu(count, GIFT_FORMS)}`,
    countdown: days === null ? null : countdownLabel(view.wishlist.occasion, days),
  };
}
```

Дописать в тест (Step 2) проверку мужского имени:
```ts
test("male names keep the plain form", () => {
  expect(ogModel(view({ ownerName: "Пётр" }), NOW).eyebrow).toBe("список: Пётр");
});
```

Run: `pnpm vitest run "apps/web/src/app/\[slug\]/og-model.test.ts"`
Expected: PASS (5 тестов).

- [ ] **Step 4: Проверка и commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add apps/web
git commit -m "feat(web): data model for the shared wishlist preview"
```

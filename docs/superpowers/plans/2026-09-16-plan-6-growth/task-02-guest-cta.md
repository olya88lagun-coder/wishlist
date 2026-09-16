# Task 2: «Соберите свой вишлист» для гостей

**Files:**
- Create: `apps/web/src/components/start-links.ts`
- Test: `apps/web/src/components/start-links.test.ts`
- Create: `apps/web/src/app/[slug]/GuestCta.tsx`
- Modify: `apps/web/src/app/[slug]/page.tsx`, `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `getEnv().TELEGRAM_BOT_USERNAME`; `readViewer` (web).
- Produces:
  ```ts
  // start-links.ts — общие ссылки «начать» для публичной страницы и лендинга (Task 3)
  const GUEST_START_PAYLOAD = "guest";
  type StartLink = { id: "telegram" | "site" | "lists"; label: string; href: string; external: boolean };
  function startLinks(botUsername: string, signedIn: boolean): StartLink[];
  // GuestCta.tsx
  function GuestCta(props: { botUsername: string; signedIn: boolean; reservedSomething: boolean }): JSX.Element;
  ```

Гость, открывший чужой список, — самый дешёвый будущий владелец: он уже видел, как это работает. Бот на `/start guest` отвечает обычным приветствием (параметр не начинается с `r`, см. план 4), отдельного обработчика не нужно.

- [ ] **Step 1: Тест ссылок (падает)**

`apps/web/src/components/start-links.test.ts`:
```ts
import { expect, test } from "vitest";
import { GUEST_START_PAYLOAD, startLinks } from "./start-links";

test("visitors without an account can start in Telegram or on the site", () => {
  expect(startLinks("my_wish_list1_bot", false)).toEqual([
    { id: "telegram", label: "Собрать в Telegram", href: `https://t.me/my_wish_list1_bot?start=${GUEST_START_PAYLOAD}`, external: true },
    { id: "site", label: "Собрать на сайте", href: "/login", external: false },
  ]);
});

test("signed-in visitors go straight to their lists", () => {
  expect(startLinks("my_wish_list1_bot", true)).toEqual([{ id: "lists", label: "Открыть мои списки", href: "/lists", external: false }]);
});
```

Run: `pnpm vitest run apps/web/src/components/start-links.test.ts`
Expected: FAIL — `Failed to resolve import "./start-links"`.

- [ ] **Step 2: Ссылки — реализация**

`apps/web/src/components/start-links.ts`:
```ts
export const GUEST_START_PAYLOAD = "guest";

export type StartLink = { id: "telegram" | "site" | "lists"; label: string; href: string; external: boolean };

export function startLinks(botUsername: string, signedIn: boolean): StartLink[] {
  if (signedIn) return [{ id: "lists", label: "Открыть мои списки", href: "/lists", external: false }];
  return [
    { id: "telegram", label: "Собрать в Telegram", href: `https://t.me/${botUsername}?start=${GUEST_START_PAYLOAD}`, external: true },
    { id: "site", label: "Собрать на сайте", href: "/login", external: false },
  ];
}
```

Run: `pnpm vitest run apps/web/src/components/start-links.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 3: Блок на публичной странице**

`apps/web/src/app/[slug]/GuestCta.tsx`:
```tsx
import { startLinks } from "@/components/start-links";

type Props = { botUsername: string; signedIn: boolean; reservedSomething: boolean };

export function GuestCta({ botUsername, signedIn, reservedSomething }: Props) {
  return (
    <section className="panel stack guest-cta" aria-label="Свой вишлист">
      <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>
        {reservedSomething ? "Подарок выбран. А что хотите вы?" : "Соберите свой вишлист"}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        Вставьте ссылки из любых магазинов — фото и цены подтянутся сами. Друзья бронируют подарки, а вы не знаете, кто что дарит.
      </p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {startLinks(botUsername, signedIn).map((link, index) => (
          <a
            key={link.id}
            className={index === 0 ? "button button--small" : "button button--ghost button--small"}
            href={link.href}
            {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
```

`apps/web/src/app/[slug]/page.tsx`: импорт `import { GuestCta } from "./GuestCta";`, и перед блоком `<div style={{ marginTop: 32 }}>` с `ShareBar` вставить:
```tsx
      {!isOwner && (
        <div style={{ marginTop: 32 }}>
          <GuestCta
            botUsername={env.TELEGRAM_BOT_USERNAME}
            signedIn={user !== null}
            reservedSomething={items.some((item) => item.status === "reserved_by_me")}
          />
        </div>
      )}
```
(`env` и `user` уже есть на странице после плана 4.)

`apps/web/src/app/globals.css` — в конец:
```css
.guest-cta { border: 1px solid var(--line); }
```

- [ ] **Step 4: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS.

Локально: публичная страница без входа — внизу блок «Соберите свой вишлист» с двумя кнопками; после брони подарка заголовок «Подарок выбран. А что хотите вы?»; у владельца блока нет.

```bash
git add apps/web
git commit -m "feat(web): invite guests to start their own wishlist"
```

# Task 4: Политика конфиденциальности и согласие у брони

**Files:**
- Create: `apps/web/src/app/privacy/operator.ts`, `apps/web/src/app/privacy/page.tsx`
- Test: `apps/web/src/app/privacy/operator.test.ts`
- Modify: `apps/web/src/components/SiteFooter.tsx`, `apps/web/src/app/[slug]/ReserveSheet.tsx`, `apps/web/src/app/[slug]/page.tsx` (подвал)

**Interfaces:**
- Consumes: `SiteFooter` (Task 3).
- Produces:
  ```ts
  // operator.ts
  const OPERATOR: { name: string; inn: string; email: string };
  const PRIVACY_UPDATED_AT: string;   // "YYYY-MM-DD"
  const COLLECTED_DATA: readonly { what: string; why: string; where: string }[];
  ```

Сервис уже хранит персональные данные: имена и Telegram id пользователей, имя гостя в брони, cookie гостя. По 152-ФЗ нужна опубликованная политика и согласие при вводе данных. Текст — обязанность владельца сервиса; задача даёт структуру, которая перечисляет реально собираемые данные, а оператора пользователь указывает сам.

- [x] **Step 1: Данные оператора (пользователь)**

Спросить у пользователя и получить явный ответ (без догадок):
1. ФИО оператора (самозанятый).
2. ИНН.
3. Email для обращений по персональным данным.

Эти данные публичны на странице политики. Если пользователь не хочет публиковать ИНН — остановиться и уточнить (для самозанятого оператора ИНН обычно указывают; решение за пользователем).

- [x] **Step 2: Тест (падает)**

`apps/web/src/app/privacy/operator.test.ts`:
```ts
import { expect, test } from "vitest";
import { COLLECTED_DATA, OPERATOR, PRIVACY_UPDATED_AT } from "./operator";

test("operator details are filled in", () => {
  expect(OPERATOR.name.trim().split(" ").length).toBeGreaterThanOrEqual(2);
  expect(OPERATOR.inn).toMatch(/^\d{12}$/);
  expect(OPERATOR.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  expect(PRIVACY_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("the policy lists everything the service actually stores", () => {
  const listed = COLLECTED_DATA.map((row) => row.what).join(" | ");
  for (const data of ["Имя и фото профиля Telegram", "Идентификатор Telegram", "VK ID", "Имя гостя", "Cookie", "Ссылки на товары"]) {
    expect(listed).toContain(data);
  }
  expect(COLLECTED_DATA.every((row) => row.why.length > 10 && row.where.length > 3)).toBe(true);
});
```

Run: `pnpm vitest run apps/web/src/app/privacy`
Expected: FAIL — `Failed to resolve import "./operator"`.

- [x] **Step 3: Данные политики**

`apps/web/src/app/privacy/operator.ts` (подставить ответы Step 1 вместо значений в кавычках `OPERATOR`):
```ts
export const OPERATOR = {
  name: "<ФИО из Step 1>",
  inn: "<ИНН из Step 1>",
  email: "<email из Step 1>",
} as const;

export const PRIVACY_UPDATED_AT = "<дата выполнения задачи, YYYY-MM-DD>";

// Перечень держать в соответствии со схемой базы: добавили поле с личными данными — добавьте строку сюда
export const COLLECTED_DATA = [
  { what: "Имя и фото профиля Telegram", why: "показывать владельцу его профиль и подписывать списки", where: "база данных сервиса в России" },
  { what: "Идентификатор Telegram", why: "вход, уведомления о бронях и напоминания в боте", where: "база данных сервиса в России" },
  { what: "VK ID и имя из VK", why: "вход через VK ID", where: "база данных сервиса в России" },
  { what: "Имя гостя, указанное при брони", why: "чтобы гость видел свою бронь; владельцу списка не показывается", where: "база данных сервиса в России" },
  { what: "Cookie гостя и сессии", why: "узнавать гостя и вошедшего пользователя без регистрации", where: "браузер пользователя" },
  { what: "Ссылки на товары, названия, цены и фото товаров", why: "показывать подарки в списке", where: "база данных и файловое хранилище в России" },
] as const;
```

Если значения ещё не получены от пользователя — тест из Step 2 остаётся красным, и задача не коммитится.

- [x] **Step 4: Страница**

`apps/web/src/app/privacy/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { COLLECTED_DATA, OPERATOR, PRIVACY_UPDATED_AT } from "./operator";

export const metadata: Metadata = { title: "Политика конфиденциальности — вишлист", robots: { index: false, follow: false } };

export default function PrivacyPage() {
  return (
    <main className="page stack legal">
      <Link className="eyebrow" href="/">← На главную</Link>
      <h1 className="display" style={{ marginBottom: 0 }}>Политика <i>конфиденциальности</i></h1>
      <p className="muted">Редакция от {PRIVACY_UPDATED_AT}</p>

      <h2>Кто обрабатывает данные</h2>
      <p>
        Оператор — {OPERATOR.name}, плательщик налога на профессиональный доход, ИНН {OPERATOR.inn}. Вопросы и отзыв согласия:{" "}
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
      </p>

      <h2>Какие данные и зачем</h2>
      <ul>
        {COLLECTED_DATA.map((row) => (
          <li key={row.what}>
            <b>{row.what}</b> — {row.why}. Где хранится: {row.where}.
          </li>
        ))}
      </ul>

      <h2>Кому передаём</h2>
      <p>Данные не продаются и не передаются третьим лицам для рекламы. Хостинг и хранилище файлов расположены в России.</p>

      <h2>Сроки и удаление</h2>
      <p>
        Данные хранятся, пока существует аккаунт или бронь. Удалить аккаунт, списки или бронь можно, написав на {OPERATOR.email}; запрос выполняется в течение 30 дней.
        Резервные копии базы удаляются автоматически через 14 дней.
      </p>

      <h2>Согласие</h2>
      <p>
        Входя через Telegram или VK ID, а также бронируя подарок, вы соглашаетесь на обработку перечисленных данных для работы сервиса. Согласие можно отозвать письмом на {OPERATOR.email}.
      </p>
    </main>
  );
}
```

`apps/web/src/app/globals.css` — в конец:
```css
.legal h2 { font-size: 18px; margin: 18px 0 0; }
.legal p, .legal li { margin: 6px 0; }
```

- [x] **Step 5: Ссылки на политику**

`apps/web/src/components/SiteFooter.tsx` — после ссылки «Бот в Telegram» добавить:
```tsx
      <a href="/privacy">Политика конфиденциальности</a>
```

`apps/web/src/app/[slug]/ReserveSheet.tsx` — заменить строку
```tsx
              <p className="muted" style={{ margin: 0 }}>{ownerName} не узнает, кто дарит</p>
```
на
```tsx
              <p className="muted" style={{ margin: 0 }}>{ownerName} не узнает, кто дарит</p>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Нажимая «Я подарю», вы соглашаетесь на обработку указанного имени по{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">политике конфиденциальности</a>.
              </p>
```

`apps/web/src/app/[slug]/page.tsx`: импорт `import { SiteFooter } from "@/components/SiteFooter";` и перед `</main>` добавить `<SiteFooter botUsername={env.TELEGRAM_BOT_USERNAME} />`.

- [x] **Step 6: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build`
Expected: PASS.

Локально: `/privacy` открывается без входа, данные оператора верные; в окне брони строка о согласии со ссылкой; подвал с ссылкой на политику на лендинге, входе и публичной странице.

```bash
git add apps/web
git commit -m "feat(web): privacy policy and consent at reservation"
```

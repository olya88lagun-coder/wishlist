# Task 3: Сквозной тест главного сценария (Playwright)

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/main-flow.spec.ts`
- Modify: `package.json` (корень: devDependency и скрипт `test:e2e`), `vitest.config.ts` (исключить `e2e`), `.gitignore`

**Interfaces:**
- Consumes: `/api/dev/login?name=…` (план 2, только при `DEV_LOGIN=1` и не в production); формы создания списка и подарка; публичная страница, окно брони, «Снять бронь».
- Produces: `pnpm test:e2e` — локальный прогон против `pnpm dev:db` + `pnpm dev:web`.

Сценарий из спеки (раздел 9): владелец создаёт список → добавляет подарок → открывает публичную ссылку → гость в отдельном браузере бронирует → видит «вы дарите» → снимает бронь → подарок снова свободен. Плюс проверка приватности на странице владельца: имени гостя нет.

- [ ] **Step 1: Зависимость**

```bash
pnpm add -D -w @playwright/test@1.63.0
pnpm exec playwright install chromium
```
Expected: `@playwright/test` в корневом `package.json` без `^`; Chromium скачан (~150 МБ, в кэш пользователя, не в репозиторий).

В корневой `package.json` в `scripts` добавить:
```json
"test:e2e": "playwright test -c e2e/playwright.config.ts"
```

В `.gitignore` добавить:
```
e2e/test-results/
e2e/playwright-report/
```

В корневом `vitest.config.ts` Vitest не должен подхватывать спеки Playwright — `projects: ["packages/*", "apps/*"]` папку `e2e` не включает, изменений не нужно; проверить командой `pnpm test` после Step 3 (число тестовых файлов не изменилось).

- [ ] **Step 2: Конфиг**

`e2e/playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

// Только локальное приложение: dev-вход работает лишь с DEV_LOGIN=1 и не в production
export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  timeout: 60_000,
  retries: 0,
  use: { baseURL: "http://localhost:3000", locale: "ru-RU", trace: "retain-on-failure" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
});
```

- [ ] **Step 3: Сценарий**

`e2e/main-flow.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("owner shares a list, a guest reserves and cancels, the owner never sees who", async ({ browser }) => {
  const stamp = Date.now().toString(36);
  const listTitle = `E2E список ${stamp}`;
  const giftTitle = `Свеча ${stamp}`;

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await ownerPage.goto(`/api/dev/login?name=E2E-${stamp}`);
  await expect(ownerPage).toHaveURL(/\/lists$/);

  await ownerPage.getByText("Новый список").click();
  await ownerPage.getByLabel("Название").fill(listTitle);
  await ownerPage.getByRole("button", { name: "Создать список" }).click();
  await ownerPage.getByRole("link", { name: listTitle }).click();
  await expect(ownerPage.getByRole("heading", { level: 1 })).toHaveText(listTitle);

  await ownerPage.getByText("Добавить без ссылки или со всеми полями").click();
  await ownerPage.getByLabel("Что подарить").first().fill(giftTitle);
  await ownerPage.getByLabel("Цена, ₽").first().fill("990");
  await ownerPage.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(ownerPage.getByRole("heading", { name: giftTitle })).toBeVisible();

  const publicHref = await ownerPage.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
  expect(publicHref).toMatch(/^\/[A-Za-z0-9]{10}$/);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(publicHref!);
  await expect(guestPage.getByRole("heading", { name: giftTitle })).toBeVisible();
  await guestPage.getByRole("button", { name: "Я подарю" }).first().click();
  await guestPage.getByLabel("Как вас подписать").fill("Тайный гость");
  await guestPage.getByRole("dialog").getByRole("button", { name: "Я подарю" }).click();
  await expect(guestPage.getByText("вы дарите")).toBeVisible();

  await ownerPage.reload();
  await expect(ownerPage.getByText("забронировано")).toBeVisible();
  await expect(ownerPage.getByText("Тайный гость")).toHaveCount(0);

  guestPage.once("dialog", (dialog) => void dialog.accept());
  await guestPage.getByRole("button", { name: "Снять бронь" }).click();
  await expect(guestPage.getByRole("button", { name: "Я подарю" }).first()).toBeVisible();

  await owner.close();
  await guest.close();
});
```

Подписи полей и кнопок взяты из текущих компонентов (`CreateListForm`, `AddItemForm`/`ItemFields`, `ReserveSheet`, `CancelReservationButton`, страница владельца). Если тест не находит элемент — сначала сверить текст в компоненте, а не ослаблять проверку.

- [ ] **Step 4: Прогон**

Три терминала: `pnpm dev:db`, `pnpm dev:web` (с `apps/web/.env.development.local`, где `DEV_LOGIN=1`), затем:
```bash
pnpm test:e2e
```
Expected: `1 passed`. При падении открыть `e2e/playwright-report/index.html` и трассу.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, количество тестовых файлов Vitest прежнее.

Остановить dev-процессы (проверить, что не осталось `node` с `dev-db` и `next dev`).

- [ ] **Step 5: Commit**

```bash
git add e2e package.json pnpm-lock.yaml .gitignore
git commit -m "test: end-to-end check of sharing, reserving and cancelling a gift"
```

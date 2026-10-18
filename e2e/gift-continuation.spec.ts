import { expect, test } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test.beforeEach(async ({ context }) => blockMetrika(context));

const idea = { title: "Керамическая кружка с крышкой", reason: "Для долгого чтения за чашкой чая.", type: "практичный", searchQuery: "керамическая кружка крышка" };

test("selected idea survives login and first wishlist creation without a second recommendation", async ({ page, context }, testInfo) => {
  let requests = 0;
  await page.route("**/api/gifts/recommend", async (route) => {
    requests++;
    expect(route.request().postDataJSON()).toMatchObject({ budget: "1000", person: "other" });
    await route.fulfill({ json: { ideas: [idea] } });
  });
  await page.goto("/gifts/under-1000");
  await page.getByLabel("Что человек любит и чем занимается?").fill("Книги и чай");
  await page.getByRole("button", { name: "Подобрать подарок", exact: true }).click();
  await page.getByRole("link", { name: "Войти и сохранить", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fgifts%2Funder-1000$/);

  // При ошибке или истечении OAuth намерения повторный вход сохраняет направление возврата.
  await page.goto("/login?error=telegram_state_mismatch");
  await expect(page.getByRole("link", { name: "Войти через VK ID", exact: true })).toHaveAttribute("href", "/api/auth/vk/start?returnTo=%2Fgifts%2Funder-1000");
  const start = page.waitForRequest("**/api/auth/telegram/start");
  await page.route("**/api/auth/telegram/start", (route) => route.fulfill({ json: { authUrl: "http://localhost:3014/api/auth/telegram/widget?state=test" } }));
  await page.route("https://telegram.org/**", (route) => route.abort());
  await page.getByRole("button", { name: "Войти через Telegram", exact: true }).click();
  expect((await start).postDataJSON()).toEqual({ returnTo: "/gifts/under-1000" });

  // Провайдер заменён локальным dev-входом; подборка и сохранение работают с реальной тестовой БД.
  await context.request.get(`/api/dev/login?name=Finder-${Date.now()}`);
  await page.goto("/gifts/under-1000");
  await expect(page.getByRole("heading", { name: idea.title })).toBeVisible();
  await page.getByRole("link", { name: "Создать вишлист", exact: true }).first().click();
  await expect(page).toHaveURL(/\/lists\?returnTo=%2Fgifts%2Funder-1000$/);
  await page.getByLabel("Название", { exact: true }).fill("Идеи из подборщика");
  await page.getByRole("button", { name: "Создать список", exact: true }).click();
  await expect(page).toHaveURL(/\/gifts\/under-1000$/);
  await expect(page.getByRole("group", { name: `Выберите вишлист для «${idea.title}»` })).toBeVisible();
  await page.getByRole("button", { name: "Идеи из подборщика", exact: true }).click();
  await expect(page.getByLabel("Подарок уже добавлен")).toBeVisible();
  expect(requests).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("restored-gift.png"), fullPage: true });
  await page.goto("/lists");
  await page.getByRole("link").filter({ hasText: "Идеи из подборщика" }).click();
  await expect(page.getByRole("heading", { name: idea.title })).toBeVisible();
  await expect(page.locator("p.card__meta").filter({ hasText: `${idea.reason} Поиск: ${idea.searchQuery}` })).toBeVisible();
});

test("an authenticated owner can resume into an existing list and create another list", async ({ page, context }) => {
  await context.request.get(`/api/dev/login?name=Existing-${Date.now()}`);
  await page.goto("/lists");
  await page.getByLabel("Название", { exact: true }).fill("Готовый список");
  await page.getByRole("button", { name: "Создать список", exact: true }).click();
  await page.route("**/api/gifts/recommend", (route) => route.fulfill({ json: { ideas: [idea] } }));
  await page.goto("/gifts/new-year");
  await page.getByLabel("Что человек любит и чем занимается?").fill("Чтение");
  await page.getByRole("button", { name: "Подобрать подарок", exact: true }).click();
  await page.getByRole("button", { name: "Добавить в вишлист", exact: true }).click();
  await page.getByRole("link", { name: "+ Создать новый вишлист", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Ещё один список");
  await page.getByRole("button", { name: "Создать список", exact: true }).click();
  await expect(page).toHaveURL(/\/gifts\/new-year$/);
  const picker = page.getByRole("group", { name: `Выберите вишлист для «${idea.title}»` });
  await expect(picker.getByRole("button", { name: "Готовый список", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Ещё один список", exact: true }).click();
  await expect(page.getByLabel("Подарок уже добавлен")).toBeVisible();
});

test("blocked tab storage keeps the selected idea on screen", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); } }); });
  await page.route("**/api/gifts/recommend", (route) => route.fulfill({ json: { ideas: [idea] } }));
  await page.goto("/gifts");
  await page.getByLabel("Что человек любит и чем занимается?").fill("Чтение");
  await page.getByRole("button", { name: "Подобрать подарок", exact: true }).click();
  await page.getByRole("link", { name: "Войти и сохранить", exact: true }).click();
  await expect(page).toHaveURL(/\/gifts$/);
  await expect(page.getByText("Браузер не разрешает сохранить подборку.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: idea.title })).toBeVisible();
});

test("page context reaches the recommendation request", async ({ page }) => {
  for (const [path, expected] of [
    ["/gifts/under-15000", { budget: "15000", person: "other", occasion: "birthday" }],
    ["/gifts/wedding", { budget: "5000", person: "other", occasion: "wedding" }],
    ["/gifts/march-8", { budget: "5000", person: "other", occasion: "march-8" }],
    ["/gifts/for-dad", { budget: "5000", person: "dad", occasion: "birthday" }],
  ] as const) {
    await page.route("**/api/gifts/recommend", async (route) => {
      expect(route.request().postDataJSON()).toMatchObject(expected);
      await route.fulfill({ json: { ideas: [idea] } });
    });
    await page.goto(path);
    await page.getByLabel("Что человек любит и чем занимается?").fill("Чтение");
    await page.getByRole("button", { name: "Подобрать подарок", exact: true }).click();
    await expect(page.getByRole("heading", { name: idea.title })).toBeVisible();
    await page.unroute("**/api/gifts/recommend");
  }
});

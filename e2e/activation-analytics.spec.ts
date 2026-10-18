import { createHash, createHmac } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { captureGoals, type GoalCall } from "./analytics-counter";

const idea = { title: "Набор акварельных карандашей", reason: "Для рисования в поездках.", type: "хобби", searchQuery: "акварельные карандаши набор" };
const count = (calls: GoalCall[], event: string) => calls.filter((call) => call.event === event).length;

async function telegramLogin(context: BrowserContext, origin: string, returnTo = "/lists") {
  const started = await context.request.post("/api/auth/telegram/start", { headers: { origin }, data: { returnTo } });
  expect(started.ok()).toBe(true);
  const url = new URL((await started.json()).authUrl);
  const fields = { id: String(Date.now()), first_name: "Тестовый владелец", auth_date: String(Math.floor(Date.now() / 1000)) };
  const secret = createHash("sha256").update("123456:local-dev-token").digest();
  const data = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
  url.searchParams.set("hash", createHmac("sha256", secret).update(data).digest("hex"));
  const finished = await context.request.get(url.toString(), { maxRedirects: 0 });
  expect(finished.status()).toBe(303);
  return finished.headers().location!;
}

test("successful activation, copy and reservation emit once without personal fields", async ({ page, context, browser, baseURL }) => {
  test.setTimeout(120_000);
  const ownerGoals = await captureGoals(context);
  await context.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } }));
  await page.route("**/api/gifts/recommend", (route) => route.fulfill({ json: { ideas: [idea] } }));
  await page.goto("/gifts/under-1000?analytics_test=1");
  await page.getByLabel("Что человек любит и чем занимается?").fill("Акварель и путешествия");
  await page.getByRole("button", { name: "Подобрать подарок", exact: true }).click();
  await page.getByRole("link", { name: "Войти и сохранить", exact: true }).click();
  const destination = await telegramLogin(context, new URL(baseURL!).origin, "/gifts/under-1000");
  await page.goto(destination);
  await expect.poll(() => count(ownerGoals, "auth_completed")).toBe(1);
  await page.getByRole("link", { name: "Создать вишлист", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Личный тестовый список");
  await page.getByRole("button", { name: "Создать список", exact: true }).click();
  await page.getByRole("button", { name: "Личный тестовый список", exact: true }).click();
  await expect(page.getByLabel("Подарок уже добавлен")).toBeVisible();
  await expect.poll(() => count(ownerGoals, "wishlist_created")).toBe(1);
  await expect.poll(() => count(ownerGoals, "gift_finder_save")).toBe(1);
  await expect.poll(() => count(ownerGoals, "wishlist_item_added")).toBe(1);

  await page.goto("/lists");
  await page.getByRole("link").filter({ hasText: "Личный тестовый список" }).click();
  const form = page.locator("details").filter({ hasText: "Добавить вручную или заполнить все поля" });
  await form.getByText("Добавить вручную или заполнить все поля").click();
  await form.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(form.locator(".error").first()).toBeVisible();
  expect(count(ownerGoals, "wishlist_item_added")).toBe(1);
  await form.getByLabel("Что подарить").fill("Рисование в путешествии");
  await form.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect.poll(() => count(ownerGoals, "wishlist_item_added")).toBe(2);
  await page.getByLabel("Вставьте ссылку на подарок").fill("https://www.ozon.ru/product/123456/");
  await page.locator("form.quick-link").getByRole("button", { name: "Добавить", exact: true }).click();
  await expect.poll(() => count(ownerGoals, "wishlist_item_added")).toBe(3);

  page.on("dialog", (dialog) => void dialog.dismiss());
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } }));
  await page.getByRole("button", { name: "Скопировать ссылку", exact: true }).click();
  expect(count(ownerGoals, "wishlist_link_copied")).toBe(0);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } }));
  await page.getByRole("button", { name: "Скопировать ссылку", exact: true }).click();
  await expect.poll(() => count(ownerGoals, "wishlist_link_copied")).toBe(1);
  const publicHref = await page.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
  await page.reload();
  expect(count(ownerGoals, "auth_completed")).toBe(1);
  expect(count(ownerGoals, "wishlist_created")).toBe(1);

  const guest = await browser.newContext();
  const guestGoals = await captureGoals(guest);
  const guestPage = await guest.newPage();
  await guestPage.goto(`${publicHref}?analytics_test=1`);
  await guestPage.getByRole("button", { name: "Я подарю", exact: true }).first().click();
  await guestPage.getByRole("dialog").getByRole("button", { name: "Я подарю", exact: true }).click();
  await expect(guestPage.getByRole("dialog").locator(".error").first()).toBeVisible();
  expect(count(guestGoals, "wishlist_reserved")).toBe(0);
  await guestPage.getByLabel("Как вас подписать").fill("Тестовый гость");
  await guestPage.getByRole("dialog").getByRole("button", { name: "Я подарю", exact: true }).click();
  await expect.poll(() => count(guestGoals, "wishlist_reserved")).toBe(1);
  await guestPage.reload();
  expect(count(guestGoals, "wishlist_reserved")).toBe(1);
  await guestPage.getByRole("link", { name: "Создать свой список", exact: true }).click();
  await expect.poll(() => count(guestGoals, "guest_wishlist_cta_click")).toBe(1);

  const serialized = JSON.stringify([...ownerGoals, ...guestGoals]);
  for (const privateValue of ["Личный тестовый список", idea.title, idea.reason, "Акварель и путешествия", "Тестовый владелец", "Тестовый гость", publicHref!]) expect(serialized).not.toContain(privateValue);
  expect([...ownerGoals, ...guestGoals].every((goal) => goal.params?.test_traffic === true)).toBe(true);
  await guest.close();
});

test("a fast guest CTA survives full navigation before counter readiness", async ({ page, context, browser }) => {
  const setupGoals = await captureGoals(context);
  await page.goto(`/api/dev/login?name=Queue-${Date.now()}`);
  await page.getByLabel("Название", { exact: true }).fill("Проверка очереди");
  await page.getByRole("button", { name: "Создать список", exact: true }).click();
  const publicHref = await page.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
  await expect.poll(() => count(setupGoals, "wishlist_created")).toBe(1);
  const guest = await browser.newContext();
  let ready!: () => void;
  const release = new Promise<void>((resolve) => { ready = resolve; });
  const goals = await captureGoals(guest, release);
  const guestPage = await guest.newPage();
  await guestPage.goto(`${publicHref}?analytics_test=1`);
  await guestPage.getByRole("link", { name: "Собрать на сайте", exact: true }).click();
  await expect(guestPage).toHaveURL(/\/login$/);
  expect(goals).toHaveLength(0);
  ready();
  await expect.poll(() => count(goals, "guest_wishlist_cta_click")).toBe(1);
  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "Войти через Telegram", exact: true })).toBeVisible();
  expect(count(goals, "guest_wishlist_cta_click")).toBe(1);
  await guest.close();
});

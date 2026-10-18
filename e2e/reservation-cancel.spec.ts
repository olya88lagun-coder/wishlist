import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

const expect = baseExpect.configure({ timeout: 15_000 });

async function reservedGift(browser: Browser) {
  const owner = await browser.newContext();
  const guest = await browser.newContext();
  await blockMetrika(owner); await blockMetrika(guest);
  const ownerPage = await owner.newPage();
  const guestPage = await guest.newPage();
  await ownerPage.goto(`/api/dev/login?name=Cancel-${Date.now()}`);
  await expect(ownerPage).toHaveURL(/\/lists$/);
  await ownerPage.getByLabel("Название").fill("Проверка отмены");
  await ownerPage.getByRole("button", { name: "Создать список", exact: true }).click();
  await expect(ownerPage.getByRole("heading", { level: 1 })).toHaveText("Проверка отмены");
  const manual = ownerPage.locator("details").filter({ hasText: "Добавить вручную или заполнить все поля" });
  await manual.getByText("Добавить вручную или заполнить все поля").click();
  await manual.getByLabel("Что подарить").fill("Свеча для проверки");
  await manual.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(ownerPage.getByRole("heading", { name: "Свеча для проверки" })).toBeVisible();
  const publicHref = await ownerPage.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
  await guestPage.goto(`${publicHref!}?analytics_test=1`);
  await guestPage.getByRole("button", { name: "Я подарю", exact: true }).click();
  await guestPage.getByLabel("Как вас подписать").fill("Тайный гость");
  await guestPage.getByRole("dialog").getByRole("button", { name: "Я подарю", exact: true }).click();
  await expect(guestPage.getByRole("button", { name: "Снять бронь", exact: true })).toBeVisible();
  return { owner, guest, ownerPage, guestPage, publicHref: publicHref! };
}

async function cancel(page: Page) {
  const button = page.getByRole("button", { name: "Снять бронь", exact: true });
  page.once("dialog", (dialog) => void dialog.accept());
  await button.click();
}

test("confirmation, pending state and a persistent success message accompany cancellation", async ({ browser }, testInfo) => {
  const f = await reservedGift(browser);
  try {
    f.guestPage.once("dialog", (dialog) => void dialog.dismiss());
    await f.guestPage.getByRole("button", { name: "Снять бронь", exact: true }).click();
    await expect(f.guestPage.getByText("вы дарите", { exact: true })).toBeVisible();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await f.guestPage.route("**/*", async (route) => {
      if (route.request().headers()["next-action"]) await gate;
      await route.fallback();
    });
    try {
      await cancel(f.guestPage);
      await expect(f.guestPage.getByRole("button", { name: "Отменяем…", exact: true })).toBeDisabled();
      await f.guestPage.screenshot({ path: testInfo.outputPath("cancellation-pending.png"), fullPage: true });
    } finally { release(); }
    await expect(f.guestPage.getByRole("status").filter({ hasText: "Ваша бронь снята." })).toBeVisible();
    await expect(f.guestPage.getByRole("button", { name: "Я подарю", exact: true })).toBeVisible();
    await f.guestPage.screenshot({ path: testInfo.outputPath("cancellation-success.png"), fullPage: true });
    // Новый цикл бронирования не должен показывать старое подтверждение отмены.
    await f.guestPage.getByRole("button", { name: "Я подарю", exact: true }).click();
    await f.guestPage.getByLabel("Как вас подписать").fill("Тайный гость");
    await f.guestPage.getByRole("dialog").getByRole("button", { name: "Я подарю", exact: true }).click();
    await expect(f.guestPage.getByRole("button", { name: "Снять бронь", exact: true })).toBeVisible();
    await expect(f.guestPage.getByText("Ваша бронь снята.", { exact: true })).toHaveCount(0);
  } finally { await f.owner.close(); await f.guest.close(); }
});

test("expired identity explains the problem and preserves the reservation", async ({ browser }, testInfo) => {
  const f = await reservedGift(browser);
  try {
    await f.guest.clearCookies();
    await cancel(f.guestPage);
    await expect(f.guestPage.getByRole("status").filter({ hasText: "Не удалось подтвердить вашу бронь" })).toBeVisible();
    await expect(f.guestPage.getByRole("button", { name: "Снять бронь", exact: true })).toBeEnabled();
    expect((await f.guest.cookies()).some((cookie) => cookie.name === "wl_guest")).toBe(false);
    await f.guestPage.screenshot({ path: testInfo.outputPath("cancellation-identity-error.png"), fullPage: true });
    await f.ownerPage.reload();
    await expect(f.ownerPage.getByText("забронировано", { exact: true })).toBeVisible();
    await expect(f.ownerPage.getByText("Тайный гость", { exact: true })).toHaveCount(0);
  } finally { await f.owner.close(); await f.guest.close(); }
});

test("a stale tab explains a cancellation that another tab already completed", async ({ browser }) => {
  const f = await reservedGift(browser);
  try {
    const second = await f.guest.newPage();
    await second.goto(f.publicHref);
    await cancel(second);
    await expect(second.getByRole("button", { name: "Я подарю", exact: true })).toBeVisible();
    await cancel(f.guestPage);
    await expect(f.guestPage.getByRole("status").filter({ hasText: "Бронь уже снята" })).toBeVisible();
    await expect(f.guestPage.getByRole("button", { name: "Я подарю", exact: true })).toBeVisible();
  } finally { await f.owner.close(); await f.guest.close(); }
});

test("a reservation loaded from a full page response can be cancelled", async ({ browser }) => {
  const f = await reservedGift(browser);
  try {
    await f.guestPage.reload({ waitUntil: "networkidle" });
    await cancel(f.guestPage);
    await expect(f.guestPage.getByRole("status").filter({ hasText: "Ваша бронь снята." })).toBeVisible();
  } finally { await f.owner.close(); await f.guest.close(); }
});

for (const delivered of [false, true]) test(`a network failure ${delivered ? "after commit" : "before delivery"} keeps the list visible and offers verification`, async ({ browser }, testInfo) => {
  const f = await reservedGift(browser);
  try {
    let aborted = false;
    await f.guestPage.route("**/*", async (route) => {
      if (!aborted && route.request().headers()["next-action"]) {
        aborted = true;
        if (delivered) await route.fetch();
        return route.abort("failed");
      }
      await route.fallback();
    });
    await cancel(f.guestPage);
    await expect(f.guestPage.getByRole("status").filter({ hasText: "Не удалось подтвердить отмену" })).toBeVisible();
    await expect(f.guestPage.getByRole("heading", { name: "Проверка отмены", exact: true })).toBeVisible();
    await expect(f.guestPage.getByRole("button", { name: "Отменяем…", exact: true })).toHaveCount(0);
    await f.guestPage.screenshot({ path: testInfo.outputPath("cancellation-network-error.png"), fullPage: true });
    await f.guestPage.getByRole("button", { name: "Обновить страницу", exact: true }).click();
    await f.guestPage.waitForLoadState("networkidle");
    await f.guestPage.screenshot({ path: testInfo.outputPath("cancellation-after-refresh.png"), fullPage: true });
    await expect(f.guestPage.getByRole("heading", { name: "Проверка отмены", exact: true })).toBeVisible();
    if (delivered) {
      await expect(f.guestPage.getByRole("button", { name: "Я подарю", exact: true })).toBeVisible();
      await expect(f.guestPage.getByRole("button", { name: "Снять бронь", exact: true })).toHaveCount(0);
    } else {
      await expect(f.guestPage.getByRole("button", { name: "Снять бронь", exact: true })).toBeVisible();
      await cancel(f.guestPage);
      await expect(f.guestPage.getByRole("status").filter({ hasText: "Ваша бронь снята." })).toBeVisible();
    }
  } finally { await f.owner.close(); await f.guest.close(); }
});

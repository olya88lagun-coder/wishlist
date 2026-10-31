import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { captureGoals } from "./analytics-counter";

const requireDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const requireCore = createRequire(new URL("../packages/core/package.json", import.meta.url));

test("theme cards show previews, prices, keyboard selection and correct checkout analytics", async ({ page, context, baseURL }, testInfo) => {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  const secret = process.env.E2E_SESSION_SECRET;
  test.skip(!databaseUrl || !secret, "Requires local fixture database and session secret");
  if (![databaseUrl!, baseURL!].every(value => ["localhost", "127.0.0.1"].includes(new URL(value).hostname))) throw new Error("Fixtures are restricted to localhost");
  const sql = requireDb("postgres")(databaseUrl!, { max: 1 });
  const { SignJWT } = requireCore("jose");
  const userId = randomUUID(), listId = randomUUID();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await sql`insert into users (id, display_name) values (${userId}, 'Проверка карточек')`;
    await sql`insert into wishlists (id, owner_id, title, occasion, slug) values (${listId}, ${userId}, 'Мои желания', 'birthday', ${randomUUID().slice(0, 10)})`;
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setAudience("session").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret!));
    await context.addCookies([{ name: "wl_session", value: token, url: baseURL! }]);
    const goals = await captureGoals(context);
    await page.goto(`/lists/${listId}/design`);
    await expect(page.locator(".design-theme-card")).toHaveCount(11);
    await expect(page.getByRole("radio", { name: "Журнал", exact: true }).locator("..")).toContainText("Бесплатно");
    const cards = page.locator(".design-theme-card");
    for (const card of await cards.all()) {
      const thumb = card.locator(".design-theme-card__thumb");
      const background = await thumb.evaluate(el => getComputedStyle(el).backgroundImage);
      const url = background.match(/url\("?(.*?)"?\)/)?.[1];
      if (url) expect((await page.request.get(url)).ok()).toBe(true);
    }
    await page.getByRole("radio", { name: "Журнал", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".design-theme-grid").getByRole("radio", { name: "Голубой", exact: true })).toBeChecked();
    await page.locator('.design-theme-card:has(input[value="new-year"])').click();
    await expect(page.locator('.design-preview .wishlist-theme[data-theme="new-year"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Применить", exact: true })).toBeDisabled();
    await page.locator("#design-email").fill("qa@example.test");
    await page.locator('input[name="consent"]').check();
    // Inspect the submitted goal; never contact the payment provider.
    await page.evaluate(() => document.querySelector(".design-checkout")!.addEventListener("submit", event => event.preventDefault()));
    await page.getByRole("button", { name: "Перейти к оплате", exact: true }).click();
    await expect.poll(() => goals.filter(goal => goal.event === "design_theme_pay_click")).toEqual([
      { event: "design_theme_pay_click", params: { theme: "new-year", product: "new_year" } },
    ]);
    expect(goals.some(goal => goal.event === "design_theme_select" && goal.params?.theme === "new-year")).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("cards.png"), fullPage: true });
    if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 320, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await page.locator(".design-theme-card__meta").evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth).length)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("cards-narrow.png"), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  }
});

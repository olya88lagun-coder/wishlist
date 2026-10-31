import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { blockMetrika } from "./analytics-counter";

const requireDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const requireCore = createRequire(new URL("../packages/core/package.json", import.meta.url));
const themes = ["wedding", "quiet-luxury", "space", "flower-garden", "valentines", "march-8"] as const;

for (const theme of themes) test(`${theme} preview, purchase rights, owner and public page`, async ({ page, context, baseURL }, testInfo) => {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  const secret = process.env.E2E_SESSION_SECRET;
  test.skip(!databaseUrl || !secret, "Requires local fixture database and session secret");
  if (!["localhost", "127.0.0.1"].includes(new URL(databaseUrl!).hostname) || !["localhost", "127.0.0.1"].includes(new URL(baseURL!).hostname)) throw new Error("Fixtures are restricted to localhost");
  const sql = requireDb("postgres")(databaseUrl!, { max: 1 });
  const { SignJWT } = requireCore("jose");
  const userId = randomUUID(), listId = randomUUID(), slug = randomUUID().replaceAll("-", "").slice(0, 10);
  try {
    await sql`insert into users (id, display_name) values (${userId}, 'Анна')`;
    await sql`insert into wishlists (id, owner_id, title, occasion, slug, event_date) values (${listId}, ${userId}, 'Наши маленькие мечты', 'birthday', ${slug}, '2027-05-24')`;
    await sql`insert into items (wishlist_id, title, image_key, price_kopecks, parse_status) values (${listId}, 'Керамическая ваза', 'gifts/seo/child-1492507342.jpg', 490000, 'ok')`;
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setAudience("session").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret!));
    await context.addCookies([{ name: "wl_session", value: token, url: baseURL! }]);
    await blockMetrika(context);
    await page.goto(`/lists/${listId}/design`);
    await page.locator(`.design-theme-card:has(input[value="${theme}"])`).click();
    await expect(page.getByRole("button", { name: "Применить", exact: true })).toBeDisabled();
    await expect(page.locator(".design-checkout").getByText("149 ₽", { exact: true })).toBeVisible();
    await expect(page.locator(`.design-preview [data-theme="${theme}"]`)).toBeVisible();
    await expect(page.locator(".invitation-editor")).toHaveCount(0);
    // Simulate an already-verified purchase locally; no provider request or real charge.
    await sql`insert into design_purchases (user_id, wishlist_id, product, amount_kopecks, email, status, payment_id) values (${userId}, ${listId}, ${theme}, 14900, 'qa@example.test', 'succeeded', ${randomUUID()})`;
    await page.reload();
    await page.locator(`.design-theme-card:has(input[value="${theme}"])`).click();
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(page.getByText("Оформление сохранено", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator(`.design-studio input[value="${theme}"]`)).toBeChecked();
    await expect(page.locator(".design-checkout")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("studio.png"), fullPage: true });
    await page.goto(`/lists/${listId}`);
    await expect(page.locator(`[data-theme="${theme}"] .celebration-heading h1`)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("owner.png"), fullPage: true });
    await context.clearCookies();
    await page.goto(`/${slug}`);
    await expect(page.locator(`[data-theme="${theme}"]`)).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Наши маленькие мечты");
    await expect(page.getByRole("button", { name: "Я подарю", exact: true })).toBeVisible();
    expect(await page.locator(".wishlist-theme").evaluate(el => getComputedStyle(el, "::before").backgroundImage)).toContain(`${theme}-pattern.webp`);
    expect(await page.locator(".celebration-heading").evaluate(el => getComputedStyle(el, "::before").backgroundImage)).toContain(`${theme}-decor.webp`);
    expect(await page.locator(".card").evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
    if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 320, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("public.png"), fullPage: true });
    expect((await sql`select count(*)::int as count from design_purchases where wishlist_id = ${listId}`)[0].count).toBe(1);
  } finally {
    await sql`delete from design_purchases where user_id = ${userId}`;
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  }
});

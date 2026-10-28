import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { blockMetrika } from "./analytics-counter";

const databaseUrl = process.env.E2E_DATABASE_URL;
const secret = process.env.E2E_SESSION_SECRET;
const requireDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const requireCore = createRequire(new URL("../packages/core/package.json", import.meta.url));
const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));

for (const product of ["children_invitation", "new_year"] as const) {
test(`paid ${product} theme saves once with a full-page background`, async ({ page, context, baseURL }, testInfo) => {
  test.skip(!databaseUrl || !secret, "Requires explicitly configured local fixture DB and session secret");
  if (!["localhost", "127.0.0.1"].includes(new URL(databaseUrl!).hostname) || !["localhost", "127.0.0.1"].includes(new URL(baseURL!).hostname)) throw new Error("Paid-design fixtures are restricted to localhost");
  const sql = requireDb("postgres")(databaseUrl!, { max: 1 });
  const { SignJWT } = requireCore("jose");
  const { PNG } = requireWeb("pngjs");
  const jsQR = requireWeb("jsqr");
  const userId = randomUUID();
  const wishlistId = randomUUID();
  const slug = randomUUID().replaceAll("-", "").slice(0, 10);
  const holiday = product === "new_year";
  const expectedTheme = holiday ? "new-year" : "children-pink";
  try {
    await sql`insert into users (id, display_name) values (${userId}, 'E2E оформление')`;
    await sql`insert into wishlists (id, owner_id, title, occasion, slug, theme_id) values (${wishlistId}, ${userId}, ${holiday ? 'Новогодние желания' : 'Праздник Саши'}, ${holiday ? 'new_year' : 'birthday'}, ${slug}, ${holiday ? 'new-year' : 'children'})`;
    await sql`insert into items (wishlist_id, title, image_key, price_kopecks, parse_status) values (${wishlistId}, 'Книга «Соедини точки»', 'gifts/seo/child-1492507342.jpg', 99000, 'ok'), (${wishlistId}, 'Настольная игра', 'gifts/seo/child-1434991591.jpg', 249000, 'ok')`;
    await sql`insert into design_purchases (user_id, wishlist_id, product, amount_kopecks, email, status, payment_id) values (${userId}, ${wishlistId}, ${product}, ${holiday ? 14900 : 19900}, 'qa@example.test', 'succeeded', ${randomUUID()})`;
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setAudience("session").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret!));
    await context.addCookies([{ name: "wl_session", value: token, url: baseURL! }]);
    await blockMetrika(context);
    await page.goto(`/lists/${wishlistId}/design`);
    await page.locator(`.design-studio input[value="${expectedTheme}"]`).check();
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(page.getByText("Оформление сохранено", { exact: true })).toBeVisible();
    await expect(page.locator(".design-studio")).toHaveCount(1);
    await expect(page.locator(".invitation-editor")).toHaveCount(holiday ? 0 : 1);
    expect((await sql`select theme_id from wishlists where id = ${wishlistId}`)[0].theme_id).toBe(expectedTheme);
    await page.reload();
    await expect(page.locator(`.design-studio input[value="${expectedTheme}"]`)).toBeChecked();
    if (!holiday) {
      await page.getByLabel("Имя ребёнка", { exact: true }).fill("Саша");
      await page.getByLabel("Дата праздника", { exact: true }).fill("2026-12-12");
      await page.getByLabel("Время", { exact: true }).fill("15:30");
      await page.getByLabel("Место (необязательно)").fill("Тестовый частный адрес");
      await page.locator('.invitation-editor input[value="pink"]').check();
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "Скачать PNG", exact: true }).click();
      const download = await downloadEvent;
      const file = testInfo.outputPath("invitation.png");
      await download.saveAs(file);
      const png = PNG.sync.read(await readFile(file));
      expect([png.width, png.height]).toEqual([1080, 1440]);
      expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(new URL(`/${slug}`, baseURL!).toString());
    } else {
      const response = await context.request.post(`/api/lists/${wishlistId}/invitation`, { headers: { Origin: new URL(baseURL!).origin }, data: { name: "Саша", date: "2026-12-12", time: "15:30" } });
      expect(response.status()).toBe(403);
      await page.locator('.design-studio input[value="children"]').check();
      await expect(page.getByRole("button", { name: "Применить", exact: true })).toBeDisabled();
      await expect(page.getByText("199 ₽", { exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.goto(`/${slug}`);
    await expect(page.locator(`[data-theme="${expectedTheme}"]`)).toBeVisible();
    await expect(page.getByText("Тестовый частный адрес")).toHaveCount(0);
    const layer = await page.locator(".wishlist-theme").evaluate(el => getComputedStyle(el, "::before").backgroundImage);
    expect(layer).toContain(holiday ? "new-year-pattern.webp" : "children-pattern.webp");
    expect(await page.locator(".card").first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      for (const img of await page.locator('.tile__img').all()) await img.evaluate(img => (img as HTMLImageElement).decode());
      await page.screenshot({ path: testInfo.outputPath(`${product}-${width}.png`), fullPage: true });
    }
  } finally {
    await sql`delete from design_purchases where user_id = ${userId}`;
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  }
});
}

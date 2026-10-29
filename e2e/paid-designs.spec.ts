import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { blockMetrika } from "./analytics-counter";

const databaseUrl = process.env.E2E_DATABASE_URL;
const secret = process.env.E2E_SESSION_SECRET;
const requireDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const requireCore = createRequire(new URL("../packages/core/package.json", import.meta.url));
const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));

for (const product of ["children_invitation", "new_year", "celebration"] as const) {
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
  const celebration = product === "celebration";
  const standalone = product !== "children_invitation";
  const holiday = product === "new_year";
  const expectedTheme = celebration ? "celebration" : holiday ? "new-year" : testInfo.project.name === "mobile" ? "children" : "children-pink";
  try {
    await sql`insert into users (id, display_name) values (${userId}, 'E2E оформление')`;
    await sql`insert into wishlists (id, owner_id, title, occasion, slug, theme_id) values (${wishlistId}, ${userId}, ${holiday ? 'Новогодние желания' : celebration ? 'День рождения' : 'Праздник Саши'}, ${holiday ? 'new_year' : 'birthday'}, ${slug}, ${expectedTheme})`;
    await sql`insert into items (wishlist_id, title, image_key, price_kopecks, parse_status) values (${wishlistId}, 'Книга «Соедини точки»', 'gifts/seo/child-1492507342.jpg', 99000, 'ok'), (${wishlistId}, 'Настольная игра', 'gifts/seo/child-1434991591.jpg', 249000, 'ok')`;
    await sql`insert into design_purchases (user_id, wishlist_id, product, amount_kopecks, email, status, payment_id) values (${userId}, ${wishlistId}, ${product}, ${standalone ? 14900 : 19900}, 'qa@example.test', 'succeeded', ${randomUUID()})`;
    if (celebration) await sql`update wishlists set event_date = '2026-12-12' where id = ${wishlistId}`;
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setAudience("session").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret!));
    await context.addCookies([{ name: "wl_session", value: token, url: baseURL! }]);
    await blockMetrika(context);
    // An already-purchased, already-selected theme upgrades without Apply or a new purchase.
    await page.goto(`/${slug}`);
    await expect(page.locator(".celebration-heading")).toBeVisible();
    await expect(page.locator(`[data-theme="${expectedTheme}"]`)).toBeVisible();
    expect((await sql`select count(*)::int as count from design_purchases where wishlist_id = ${wishlistId}`)[0].count).toBe(1);
    await page.goto(`/lists/${wishlistId}`);
    await expect(page.locator(".celebration-heading h1")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("owner.png"), fullPage: true });
    await page.goto(`/lists/${wishlistId}/design`);
    await expect(page.locator(".design-preview .celebration-heading")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("studio.png"), fullPage: true });
    await page.locator(`.design-studio input[value="${expectedTheme}"]`).check();
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(page.getByText("Оформление сохранено", { exact: true })).toBeVisible();
    await expect(page.locator(".design-studio")).toHaveCount(1);
    await expect(page.locator(".invitation-editor")).toHaveCount(standalone ? 0 : 1);
    expect((await sql`select theme_id from wishlists where id = ${wishlistId}`)[0].theme_id).toBe(expectedTheme);
    await page.reload();
    await expect(page.locator(`.design-studio input[value="${expectedTheme}"]`)).toBeChecked();
    if (!standalone) {
      await page.getByLabel("Имя ребёнка", { exact: true }).fill("Саша");
      await page.getByLabel("Дата праздника", { exact: true }).fill("2026-12-12");
      await page.getByLabel("Время", { exact: true }).fill("15:30");
      await page.getByLabel("Место (необязательно)").fill("Тестовый частный адрес");
      await page.locator(`.invitation-editor input[value="${expectedTheme === "children-pink" ? "pink" : "blue"}"]`).check();
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "Скачать PNG", exact: true }).click();
      const download = await downloadEvent;
      const file = testInfo.outputPath("invitation.png");
      await download.saveAs(file);
      const png = PNG.sync.read(await readFile(file));
      expect([png.width, png.height]).toEqual([1080, 1440]);
      expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(new URL(`/${slug}`, baseURL!).toString());
      if (testInfo.project.name === "desktop") {
        const response = await context.request.post(`/api/lists/${wishlistId}/invitation`, { headers: { Origin: new URL(baseURL!).origin }, data: { color: "pink", name: "Ш".repeat(40), age: "99", date: "2028-12-31", time: "23:59", place: "Ш".repeat(120), message: "Ж".repeat(180) } });
        expect(response.status()).toBe(200);
        const bytes = await response.body();
        await writeFile(testInfo.outputPath("invitation-long.png"), bytes);
        const longPng = PNG.sync.read(bytes);
        expect(jsQR(new Uint8ClampedArray(longPng.data), longPng.width, longPng.height)?.data).toBe(new URL(`/${slug}`, baseURL!).toString());
      }
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
    if (celebration) {
      await context.clearCookies();
      await page.reload();
      await expect(page.locator(".celebration-heading time")).toHaveAttribute("datetime", "2026-12-12");
      await expect(page.getByRole("button", { name: "Я подарю", exact: true }).first()).toBeVisible();
      await expect(page.locator("h1")).toHaveText("День рождения");
      expect(await page.locator(".wishlist-theme").evaluate(el => getComputedStyle(el).backgroundImage)).toContain("radial-gradient");
    }
    const layer = await page.locator(".wishlist-theme").evaluate(el => getComputedStyle(el, "::before").backgroundImage);
    expect(layer).toContain(celebration ? "celebration-pattern.svg" : holiday ? "new-year-pattern.webp" : "children-pattern.webp");
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

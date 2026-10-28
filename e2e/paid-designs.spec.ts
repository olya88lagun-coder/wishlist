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

test("paid color saves once and private invitation exports a readable QR", async ({ page, context, baseURL }, testInfo) => {
  test.skip(!databaseUrl || !secret, "Requires explicitly configured local fixture DB and session secret");
  if (!["localhost", "127.0.0.1"].includes(new URL(databaseUrl!).hostname) || !["localhost", "127.0.0.1"].includes(new URL(baseURL!).hostname)) throw new Error("Paid-design fixtures are restricted to localhost");
  const sql = requireDb("postgres")(databaseUrl!, { max: 1 });
  const { SignJWT } = requireCore("jose");
  const { PNG } = requireWeb("pngjs");
  const jsQR = requireWeb("jsqr");
  const userId = randomUUID();
  const wishlistId = randomUUID();
  const slug = randomUUID().replaceAll("-", "").slice(0, 10);
  try {
    await sql`insert into users (id, display_name) values (${userId}, 'E2E оформление')`;
    await sql`insert into wishlists (id, owner_id, title, occasion, slug, theme_id) values (${wishlistId}, ${userId}, 'Праздник Саши', 'birthday', ${slug}, 'children')`;
    await sql`insert into design_purchases (user_id, wishlist_id, product, amount_kopecks, email, status, payment_id) values (${userId}, ${wishlistId}, 'children_invitation', 19900, 'qa@example.test', 'succeeded', ${randomUUID()})`;
    const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setAudience("session").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret!));
    await context.addCookies([{ name: "wl_session", value: token, url: baseURL! }]);
    await blockMetrika(context);
    await page.goto(`/lists/${wishlistId}/design`);
    await page.locator('.design-studio input[value="children-pink"]').check();
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(page.getByText("Оформление сохранено", { exact: true })).toBeVisible();
    await expect(page.locator(".design-studio")).toHaveCount(1);
    await expect(page.locator(".invitation-editor")).toHaveCount(1);
    expect((await sql`select theme_id from wishlists where id = ${wishlistId}`)[0].theme_id).toBe("children-pink");
    await page.reload();
    await expect(page.locator('.design-studio input[value="children-pink"]')).toBeChecked();
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
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.goto(`/${slug}`);
    await expect(page.locator('[data-theme="children-pink"]')).toBeVisible();
    await expect(page.getByText("Тестовый частный адрес")).toHaveCount(0);
  } finally {
    await sql`delete from design_purchases where user_id = ${userId}`;
    await sql`delete from users where id = ${userId}`;
    await sql.end();
  }
});

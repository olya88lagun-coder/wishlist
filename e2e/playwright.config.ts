import { defineConfig, devices } from "@playwright/test";

// Только локальное приложение: dev-вход работает лишь с DEV_LOGIN=1 и не в production.
// Браузер — установленный Chrome: CDN со сборками Playwright с машины разработчика недоступен.
export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  timeout: 60_000,
  retries: 0,
  use: { baseURL: "http://localhost:3000", locale: "ru-RU", trace: "retain-on-failure" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL ?? "chrome" } }],
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
});

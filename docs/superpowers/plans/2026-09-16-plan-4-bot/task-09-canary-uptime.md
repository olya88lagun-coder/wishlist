# Task 9: Canary парсера и проверка сайта с алертом администратору

**Files:**
- Create: `apps/worker/src/monitoring.ts`
- Test: `apps/worker/src/monitoring.test.ts`
- Modify: `apps/worker/src/jobs.ts`

**Interfaces:**
- Consumes: `parseProduct`, `ParseResult` из `@wishlist/parser`; `TelegramConfig.adminId`, `Messenger` (Task 4); `QUEUES.canary`, `QUEUES.uptime`.
- Produces:
  ```ts
  const CANARY_CRON = "0 10 * * *";
  const UPTIME_CRON = "*/5 * * * *";
  const CANARY_URLS: readonly string[];
  type CanaryDeps = { parse(url: string): Promise<ParseResult>; alert(text: string): Promise<void>; log: Logger };
  function runCanary(deps: CanaryDeps): Promise<{ failures: string[] }>;
  type UptimeDeps = { check(): Promise<boolean>; alert(text: string): Promise<void>; log: Logger };
  const UPTIME_FAILURES_TO_ALERT = 2;
  function createUptimeMonitor(deps: UptimeDeps): { tick(): Promise<void> };
  function checkHealth(appUrl: string, fetchFn?: typeof fetch): Promise<boolean>;
  ```

Canary парсит по одной реальной ссылке на магазин **мимо кэша** (напрямую `parseProduct`) и ждёт `status: "ok"` с фото. Ссылки — те же товары, что в фикстурах (`packages/parser/fixtures/SOURCES.md`). Если товар сняли с продажи, canary пришлёт алерт — заменить ссылку на живую.

Проверка сайта: `GET ${APP_URL}/api/health` раз в 5 минут; алерт после 2 неудач подряд (одна случайная не будит администратора), одно сообщение о восстановлении. Состояние — в памяти процесса (при перезапуске воркера счётчик начинается заново, этого достаточно).

Без `ADMIN_TELEGRAM_ID` алерты пишутся только в лог (`warn`).

- [ ] **Step 1: Тест (падает)**

`apps/worker/src/monitoring.test.ts`:
```ts
import type { ParseResult } from "@wishlist/parser";
import { describe, expect, test } from "vitest";
import { CANARY_URLS, checkHealth, createUptimeMonitor, runCanary, UPTIME_FAILURES_TO_ALERT } from "./monitoring";

const ok = (url: string): ParseResult => ({ status: "ok", store: "wildberries", finalUrl: url, title: "Товар", description: null, imageUrl: "https://img/1.webp", priceKopecks: 100, currency: "RUB" });

describe("runCanary", () => {
  test("checks one real link per store and stays silent when all parse fully", async () => {
    const alerts: string[] = [];
    const parsed: string[] = [];
    const result = await runCanary({ parse: async (url) => (parsed.push(url), ok(url)), alert: async (t) => void alerts.push(t), log: () => undefined });
    expect(parsed).toEqual([...CANARY_URLS]);
    expect(CANARY_URLS.map((u) => new URL(u).hostname)).toEqual(["www.wildberries.ru", "goldapple.ru", "market.yandex.ru"]);
    expect(result.failures).toEqual([]);
    expect(alerts).toEqual([]);
  });

  test("one alert lists every broken store, including missing photos and crashes", async () => {
    const alerts: string[] = [];
    const result = await runCanary({
      parse: async (url) => {
        if (url.includes("goldapple")) return { ...ok(url), imageUrl: null };
        if (url.includes("market")) throw new Error("boom");
        return { ...ok(url), status: "partial", priceKopecks: null };
      },
      alert: async (t) => void alerts.push(t),
      log: () => undefined,
    });
    expect(result.failures).toHaveLength(3);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain("⚠️ Canary парсера");
    expect(alerts[0]).toContain("www.wildberries.ru — partial");
    expect(alerts[0]).toContain("goldapple.ru — без фото");
    expect(alerts[0]).toContain("market.yandex.ru — ошибка");
  });
});

describe("uptime monitor", () => {
  test("alerts after consecutive failures and once on recovery", async () => {
    const alerts: string[] = [];
    let healthy = true;
    const monitor = createUptimeMonitor({ check: async () => healthy, alert: async (t) => void alerts.push(t), log: () => undefined });
    await monitor.tick();
    healthy = false;
    for (let i = 0; i < UPTIME_FAILURES_TO_ALERT + 3; i++) await monitor.tick();
    expect(alerts).toEqual(["🔴 Сайт не отвечает: /api/health — 2 проверки подряд"]);
    healthy = true;
    await monitor.tick();
    await monitor.tick();
    expect(alerts).toEqual(["🔴 Сайт не отвечает: /api/health — 2 проверки подряд", "🟢 Сайт снова отвечает"]);
  });

  test("a single failure is not reported", async () => {
    const alerts: string[] = [];
    const results = [false, true, false, true];
    const monitor = createUptimeMonitor({ check: async () => results.shift() ?? true, alert: async (t) => void alerts.push(t), log: () => undefined });
    for (let i = 0; i < 4; i++) await monitor.tick();
    expect(alerts).toEqual([]);
  });
});

test("checkHealth treats non-2xx, network errors and timeouts as down", async () => {
  expect(await checkHealth("https://my-wish-list.online", async () => new Response("{}", { status: 200 }))).toBe(true);
  expect(await checkHealth("https://my-wish-list.online", async () => new Response("", { status: 502 }))).toBe(false);
  expect(await checkHealth("https://my-wish-list.online", async () => { throw new Error("ECONNREFUSED"); })).toBe(false);
});
```

Run: `pnpm vitest run apps/worker/src/monitoring.test.ts`
Expected: FAIL — `Failed to resolve import "./monitoring"`.

- [ ] **Step 2: Реализация**

`apps/worker/src/monitoring.ts`:
```ts
import type { ParseResult } from "@wishlist/parser";
import type { Logger } from "./log";

export const CANARY_CRON = "0 10 * * *";
export const UPTIME_CRON = "*/5 * * * *";
export const UPTIME_FAILURES_TO_ALERT = 2;
const HEALTH_TIMEOUT_MS = 10_000;

// Те же товары, что в фикстурах парсера (packages/parser/fixtures/SOURCES.md)
export const CANARY_URLS = [
  "https://www.wildberries.ru/catalog/173937886/detail.aspx",
  "https://goldapple.ru/19000378828-cardamom-moss",
  "https://market.yandex.ru/card/elektrochaynik-s-dvoynymi-stenkami-kolboy-iz-nerzhaveyushchey-stali-vyborom-temperatury-tuvio-tkp1517s-terrakota/103830995648",
] as const;

export type CanaryDeps = { parse(url: string): Promise<ParseResult>; alert(text: string): Promise<void>; log: Logger };

async function canaryProblem(url: string, deps: CanaryDeps): Promise<string | null> {
  const host = new URL(url).hostname;
  try {
    const result = await deps.parse(url);
    if (result.status !== "ok") return `${host} — ${result.status}`;
    if (!result.imageUrl) return `${host} — без фото`;
    return null;
  } catch (error) {
    deps.log("error", "canary parse crashed", { url, error: String(error) });
    return `${host} — ошибка`;
  }
}

export async function runCanary(deps: CanaryDeps): Promise<{ failures: string[] }> {
  const failures: string[] = [];
  for (const url of CANARY_URLS) {
    const problem = await canaryProblem(url, deps);
    if (problem) failures.push(problem);
  }
  deps.log(failures.length > 0 ? "warn" : "info", "canary finished", { failures });
  if (failures.length > 0) await deps.alert(["⚠️ Canary парсера: магазины отдают неполные данные", ...failures.map((f) => `• ${f}`)].join("\n"));
  return { failures };
}

export type UptimeDeps = { check(): Promise<boolean>; alert(text: string): Promise<void>; log: Logger };

export function createUptimeMonitor(deps: UptimeDeps): { tick(): Promise<void> } {
  let failuresInRow = 0;
  let alerted = false;
  return {
    async tick() {
      if (await deps.check()) {
        if (alerted) await deps.alert("🟢 Сайт снова отвечает");
        failuresInRow = 0;
        alerted = false;
        return;
      }
      failuresInRow += 1;
      deps.log("warn", "health check failed", { failuresInRow });
      if (failuresInRow === UPTIME_FAILURES_TO_ALERT) {
        alerted = true;
        await deps.alert(`🔴 Сайт не отвечает: /api/health — ${UPTIME_FAILURES_TO_ALERT} проверки подряд`);
      }
    },
  };
}

export async function checkHealth(appUrl: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchFn(new URL("/api/health", appUrl), { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}
```

Run: `pnpm vitest run apps/worker/src/monitoring.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 3: Расписание**

В `apps/worker/src/jobs.ts` импорт:
```ts
import { CANARY_CRON, checkHealth, createUptimeMonitor, runCanary, UPTIME_CRON } from "./monitoring";
```
и в конец `registerJobs` добавить:
```ts
  const alert = async (text: string) => {
    const adminId = deps.telegram?.adminId ?? null;
    if (!deps.messenger || adminId === null) {
      deps.log("warn", "admin alert (no Telegram admin configured)", { text });
      return;
    }
    const outcome = await deps.messenger.send(adminId, text, { link_preview_options: { is_disabled: true } });
    if (outcome !== "sent") deps.log("error", "admin alert not delivered", { outcome });
  };

  await boss.work(QUEUES.canary, async () => {
    await runCanary({ parse: (url) => parseProduct(url, { fetchPage: deps.fetcher.fetchPage, waitTurn: deps.waitTurn }), alert, log: deps.log });
  });
  await boss.schedule(QUEUES.canary, CANARY_CRON, {}, { tz: MAINTENANCE_TZ });

  if (deps.telegram) {
    const appUrl = deps.telegram.appUrl;
    const uptime = createUptimeMonitor({ check: () => checkHealth(appUrl), alert, log: deps.log });
    await boss.work(QUEUES.uptime, async () => {
      await uptime.tick();
    });
    await boss.schedule(QUEUES.uptime, UPTIME_CRON, {}, { tz: MAINTENANCE_TZ });
  }
```

Проверка сайта нужна только на проде (там есть `APP_URL` и бот); локально без токена расписание `uptime` не создаётся. Если расписание осталось с прошлого запуска с ботом, задачи будут создаваться, но без обработчика — это не ошибка; при необходимости `boss.unschedule(QUEUES.uptime)` в ветке `else`:
```ts
  else await boss.unschedule(QUEUES.uptime);
```
Добавить эту строку сразу после закрывающей скобки `if (deps.telegram) { ... }`.

- [ ] **Step 4: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/worker build`
Expected: PASS.

```bash
git add apps/worker
git commit -m "feat(worker): daily parser canary and site health checks with admin alerts"
```

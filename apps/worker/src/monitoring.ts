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
  if (failures.length > 0) {
    await deps.alert(["⚠️ Canary парсера: магазины отдают неполные данные", ...failures.map((failure) => `• ${failure}`)].join("\n"));
  }
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

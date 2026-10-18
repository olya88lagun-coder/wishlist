import type { BrowserContext } from "@playwright/test";

export type GoalCall = { event: string; params?: Record<string, string | number | boolean> };
const METRIKA_HOST = /^https:\/\/(?:mc\.yandex\.(?:ru|com)|mc\.webvisor\.org)\//;

// Локальные тесты перехватывают счётчик: ни цели, ни просмотры не уходят в настоящую Метрику.
export async function captureGoals(context: BrowserContext, ready?: Promise<void>) {
  const calls: GoalCall[] = [];
  await context.route("**/__analytics-test", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await context.route(METRIKA_HOST, async (route) => {
    if (!route.request().url().includes("/metrika/tag.js")) return route.abort();
    if (ready) await ready;
    try {
      await route.fulfill({ contentType: "application/javascript", body: `
        const queued = window.ym?.a || [];
        window.ym = function(id, action, event, params) {
          if (action === 'reachGoal') fetch('/__analytics-test', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,params}),keepalive:true});
          if (action === 'init') queueMicrotask(() => document.dispatchEvent(new Event('yacounter' + id + 'inited')));
        };
        for (const args of queued) window.ym(...args);
      ` });
    } catch { /* Документ мог закрыться до готовности отложенного счётчика. */ }
  });
  return calls;
}

export async function blockMetrika(context: BrowserContext) {
  await context.route(METRIKA_HOST, (route) => route.abort());
}

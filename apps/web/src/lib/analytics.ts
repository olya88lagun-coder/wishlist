import { ANALYTICS_EVENTS, analyticsParams, type AnalyticsEvent, type AnalyticsParams, METRIKA_ID, validMetrikaId } from "./analytics-events";
export type { AnalyticsEvent } from "./analytics-events";

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
    __wlMetrikaReady?: boolean;
  }
}

type PendingEvent = { event: AnalyticsEvent; params?: AnalyticsParams; at: number };
const QUEUE_KEY = `wl_metrika_queue_${METRIKA_ID}`;
const TEST_KEY = "wl_analytics_test";
const MAX_EVENTS = 100;
const MAX_AGE = 10 * 60 * 1000;
let pending: PendingEvent[] | null = null;
let listening = false;
let flushing = false;
let persistedToStorage = false;

function fresh(at: unknown): at is number {
  return typeof at === "number" && Number.isFinite(at) && at <= Date.now() && Date.now() - at <= MAX_AGE;
}
function queue(): PendingEvent[] {
  if (pending) return pending;
  pending = [];
  try {
    const raw = window.sessionStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw && raw.length <= 64_000 ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) pending = parsed.filter((item) => item && ANALYTICS_EVENTS.includes(item.event) && fresh(item.at)).slice(-MAX_EVENTS).map((item) => ({ event: item.event, at: item.at, params: analyticsParams(item.params) }));
    persistedToStorage = true;
  } catch { /* При блокировке хранилища очередь остаётся в памяти вкладки. */ }
  return pending;
}
function persist() {
  try {
    if (pending?.length) window.sessionStorage.setItem(QUEUE_KEY, JSON.stringify(pending));
    else window.sessionStorage.removeItem(QUEUE_KEY);
    persistedToStorage = true;
  } catch { persistedToStorage = false; }
}
function isTestTraffic() {
  const marker = new URLSearchParams(window.location.search).get("analytics_test");
  let marked = marker === "1";
  try {
    if (marker === "0") window.sessionStorage.removeItem(TEST_KEY);
    if (marked) window.sessionStorage.setItem(TEST_KEY, "1");
    marked ||= window.sessionStorage.getItem(TEST_KEY) === "1";
  } catch { /* Маркер из URL работает и без sessionStorage. */ }
  return marked;
}
function flush() {
  if (flushing || !window.__wlMetrikaReady || typeof window.ym !== "function") return;
  flushing = true;
  try {
    pending = queue().filter((item) => fresh(item.at));
    while (pending.length) {
      const item = pending[0]!;
      window.ym(METRIKA_ID, "reachGoal", item.event, item.params);
      pending.shift();
      persist();
    }
  } catch { /* Сбой отправки оставляет событие в очереди для следующей попытки. */ }
  finally { persist(); flushing = false; }
}

export function initializeAnalytics() {
  if (!validMetrikaId || typeof window === "undefined") return;
  isTestTraffic();
  if (!listening) {
    listening = true;
    document.addEventListener(`yacounter${METRIKA_ID}inited`, () => { window.__wlMetrikaReady = true; flush(); });
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted || !persistedToStorage) return;
      try {
        // Другой документ этой вкладки мог уже отправить сохранённую очередь.
        window.sessionStorage.getItem(QUEUE_KEY);
        pending = null;
        queue();
      } catch { /* При недоступном хранилище сохраняем очередь в памяти. */ }
      flush();
    });
  }
  queue();
  flush();
}

export function trackEvent(event: AnalyticsEvent, params?: AnalyticsParams) {
  if (!validMetrikaId || typeof window === "undefined" || !ANALYTICS_EVENTS.includes(event)) return;
  try {
    initializeAnalytics();
    const safeParams = analyticsParams(params);
    const testTraffic = isTestTraffic();
    queue().push({ event, params: testTraffic ? { ...safeParams, test_traffic: true } : safeParams, at: Date.now() });
    pending = queue().slice(-MAX_EVENTS);
    persist();
    flush();
  } catch { /* Аналитика необязательна для работы сервиса. */ }
}

export type AnalyticsEvent =
  | "gift_finder_submit"
  | "gift_finder_result"
  | "gift_finder_product_click"
  | "gift_finder_save"
  | "gift_finder_dismiss"
  | "landing_gift_finder_click";

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "112836417");

export function trackEvent(event: AnalyticsEvent, params?: Record<string, string | number | boolean>) {
  if (!Number.isInteger(METRIKA_ID) || METRIKA_ID <= 0 || typeof window === "undefined" || typeof window.ym !== "function") return;
  window.ym(METRIKA_ID, "reachGoal", event, params);
}
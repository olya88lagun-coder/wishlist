export const ANALYTICS_EVENTS = [
  "gift_finder_submit", "gift_finder_result", "gift_finder_product_click", "partner_product_click",
  "gift_finder_save", "gift_finder_dismiss", "landing_gift_finder_click", "guest_wishlist_cta_click",
  "auth_completed", "wishlist_created", "wishlist_item_added", "wishlist_link_copied", "wishlist_reserved",
  "design_theme_select", "design_theme_pay_click",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsParams = Record<string, string | number | boolean>;
export const METRIKA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "112836417");
export const validMetrikaId = Number.isSafeInteger(METRIKA_ID) && METRIKA_ID > 0;
export const COMPLETION_COOKIE_PREFIX = "wl_goal_";
export const COMPLETION_MAX_AGE_SECONDS = 300;

const PARAM_KEYS = new Set(["person", "occasion", "budget", "count", "source", "store", "partner", "sku", "placement", "destination", "signed_in", "provider", "test_traffic", "theme", "product"]);
export function analyticsParams(raw: unknown): AnalyticsParams | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const params: AnalyticsParams = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!PARAM_KEYS.has(key)) continue;
    if (key === "budget") {
      const amount = Number(String(value).replace(/[ ₽\u00a0]/g, ""));
      params.budget = Number.isFinite(amount) && amount > 0 && amount <= 1_000_000 ? String(amount) : "custom";
    } else if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.length <= 80)) {
      params[key] = value;
    }
  }
  return Object.keys(params).length ? params : undefined;
}

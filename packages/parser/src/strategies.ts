import type { StoreId } from "@wishlist/core";

export const MESSENGER_USER_AGENT = "WhatsApp/2.23.20.0";
export const LINK_PREVIEW_USER_AGENT = "TelegramBot (like TwitterBot)";

export type StoreStrategy = { fetch: boolean; userAgent: string; trustPrice: boolean };

// Спайк 2026-09-14 с московского VPS (спека 4.4)
export const STORE_STRATEGIES: Record<StoreId, StoreStrategy> = {
  wildberries: { fetch: true, userAgent: MESSENGER_USER_AGENT, trustPrice: true },
  goldapple: { fetch: true, userAgent: MESSENGER_USER_AGENT, trustPrice: true },
  yandex_market: { fetch: true, userAgent: LINK_PREVIEW_USER_AGENT, trustPrice: false },
  lamoda: { fetch: false, userAgent: LINK_PREVIEW_USER_AGENT, trustPrice: false },
  ozon: { fetch: false, userAgent: LINK_PREVIEW_USER_AGENT, trustPrice: false },
  other: { fetch: true, userAgent: LINK_PREVIEW_USER_AGENT, trustPrice: true },
};

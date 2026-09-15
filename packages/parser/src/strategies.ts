import type { StoreId } from "@wishlist/core";

export const MESSENGER_USER_AGENT = "WhatsApp/2.23.20.0";
export const LINK_PREVIEW_USER_AGENT = "TelegramBot (like TwitterBot)";
export const VK_PREVIEW_USER_AGENT = "vkShare; +http://vk.com/dev/Share";

// any — цена из любого источника; jsonld — только из Offer в JSON-LD (в тексте страницы чужие цены); none — не брать
export type PriceSource = "any" | "jsonld" | "none";
export type StoreStrategy = { fetch: boolean; userAgent: string; priceFrom: PriceSource };

// Спайк 2026-09-14 с московского VPS (спека 4.4); Маркет перепроверен 2026-09-15: на TelegramBot UA он отдаёт капчу
export const STORE_STRATEGIES: Record<StoreId, StoreStrategy> = {
  wildberries: { fetch: true, userAgent: MESSENGER_USER_AGENT, priceFrom: "any" },
  goldapple: { fetch: true, userAgent: MESSENGER_USER_AGENT, priceFrom: "any" },
  yandex_market: { fetch: true, userAgent: VK_PREVIEW_USER_AGENT, priceFrom: "jsonld" },
  lamoda: { fetch: false, userAgent: LINK_PREVIEW_USER_AGENT, priceFrom: "none" },
  ozon: { fetch: false, userAgent: LINK_PREVIEW_USER_AGENT, priceFrom: "none" },
  other: { fetch: true, userAgent: LINK_PREVIEW_USER_AGENT, priceFrom: "any" },
};

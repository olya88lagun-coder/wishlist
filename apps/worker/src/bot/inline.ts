import { countdownLabel, daysUntil, pluralRu } from "@wishlist/core";
import { type Database, findUserIdByTelegram, listWishlistsForOwner, type WishlistSummary } from "@wishlist/db";
import type { InlineQueryResultArticle } from "grammy/types";
import { escapeHtml, publicListUrl } from "./texts";

export const INLINE_START_PARAMETER = "inline";
export const MAX_INLINE_RESULTS = 20;
const GIFT_FORMS = ["подарок", "подарка", "подарков"] as const;

export type InlineAnswer = {
  results: InlineQueryResultArticle[];
  options: { cache_time: number; is_personal: true; button?: { text: string; start_parameter: string } };
};

export function filterLists(lists: readonly WishlistSummary[], query: string): WishlistSummary[] {
  const needle = query.trim().toLowerCase();
  return needle === "" ? [...lists] : lists.filter((list) => list.title.toLowerCase().includes(needle));
}

export function inlineListResult(list: WishlistSummary, appUrl: string, now: Date): InlineQueryResultArticle {
  const url = publicListUrl(appUrl, list.slug);
  const days = daysUntil(list.eventDate, now);
  const count = `${list.itemCount} ${pluralRu(list.itemCount, GIFT_FORMS)}`;
  return {
    type: "article",
    id: list.id,
    title: list.title,
    description: days === null ? count : `${count} · ${countdownLabel(list.occasion, days)}`,
    input_message_content: {
      message_text: `<b>${escapeHtml(list.title)}</b>\nМой вишлист: выбирайте подарок и бронируйте — я не узнаю, кто что дарит 🎁\n${url}`,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    },
    reply_markup: { inline_keyboard: [[{ text: "Открыть вишлист", url }]] },
  };
}

export async function answerInline(
  deps: { db: Database; appUrl: string; now: () => Date },
  telegramId: number,
  query: string,
): Promise<InlineAnswer> {
  const userId = await findUserIdByTelegram(deps.db, telegramId);
  const lists = userId ? await listWishlistsForOwner(deps.db, userId) : [];
  if (lists.length === 0) {
    return { results: [], options: { cache_time: 0, is_personal: true, button: { text: "Создать вишлист", start_parameter: INLINE_START_PARAMETER } } };
  }
  const now = deps.now();
  const results = filterLists(lists, query)
    .slice(0, MAX_INLINE_RESULTS)
    .map((list) => inlineListResult(list, deps.appUrl, now));
  return { results, options: { cache_time: 10, is_personal: true } };
}

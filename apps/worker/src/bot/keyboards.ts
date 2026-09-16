import type { BotItemCard, WishlistSummary } from "@wishlist/db";
import type { InlineKeyboardMarkup } from "grammy/types";
import { miniAppUrl } from "./texts";

// callback_data ≤ 64 байт: префикс + uuid (36) + индекс списка
export const CALLBACK = { move: "mv", moveTo: "to", back: "bk", remove: "del" } as const;
const MAX_LIST_BUTTONS = 8;

export function openAppKeyboard(appUrl: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: "Открыть вишлист", web_app: { url: miniAppUrl(appUrl) } }]] };
}

export function itemCardKeyboard(card: Pick<BotItemCard, "id" | "wishlistId">, appUrl: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "В список ▾", callback_data: `${CALLBACK.move}:${card.id}` },
        { text: "Удалить", callback_data: `${CALLBACK.remove}:${card.id}` },
      ],
      [{ text: "Изменить", web_app: { url: miniAppUrl(appUrl, `/lists/${card.wishlistId}`) } }],
    ],
  };
}

export function listChoiceKeyboard(itemId: string, lists: readonly Pick<WishlistSummary, "title">[]): InlineKeyboardMarkup {
  const rows = lists.slice(0, MAX_LIST_BUTTONS).map((list, index) => [{ text: list.title, callback_data: `${CALLBACK.moveTo}:${itemId}:${index}` }]);
  return { inline_keyboard: [...rows, [{ text: "← Назад", callback_data: `${CALLBACK.back}:${itemId}` }]] };
}

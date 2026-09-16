import type { BotMessageRef } from "@wishlist/core";
import { type BotItemCard, type Database, getBotItemCard } from "@wishlist/db";
import type { Logger } from "../log";
import type { Messenger, SendExtra } from "../telegram/messenger";
import { itemCardKeyboard } from "./keyboards";
import { itemCardText, itemDeletedByOwnerText } from "./texts";

export type CardDeps = { appUrl: string; imagesPublicBaseUrl: string | null };

export function publicImageUrl(imageKey: string | null, baseUrl: string | null): string | null {
  if (!imageKey || !baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, "")}/${imageKey.split("/").map(encodeURIComponent).join("/")}`;
}

// Фото показываем превью ссылки: так карточку можно редактировать текстом, не пересоздавая сообщение
export function renderItemCard(card: BotItemCard, deps: CardDeps): { text: string; extra: SendExtra } {
  const imageUrl = publicImageUrl(card.imageKey, deps.imagesPublicBaseUrl);
  return {
    text: itemCardText(card),
    extra: {
      reply_markup: itemCardKeyboard(card, deps.appUrl),
      link_preview_options: imageUrl ? { url: imageUrl, prefer_large_media: true, show_above_text: true } : { is_disabled: true },
    },
  };
}

export async function updateItemCardMessage(
  deps: CardDeps & { db: Database; messenger: Messenger; log: Logger },
  itemId: string,
  ref: BotMessageRef,
): Promise<void> {
  const card = await getBotItemCard(deps.db, itemId);
  if (!card) return;
  const message = card.deleted
    ? { text: itemDeletedByOwnerText(card), extra: { reply_markup: { inline_keyboard: [] } } }
    : renderItemCard(card, deps);
  const outcome = await deps.messenger.edit(ref.chatId, ref.messageId, message.text, message.extra);
  if (outcome !== "sent") deps.log("warn", "bot card not updated", { itemId, outcome });
}

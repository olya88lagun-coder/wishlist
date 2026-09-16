import type { ParseItemJob } from "@wishlist/core";
import { addItem, type Database, getBotItemCard, listWishlistsForOwner } from "@wishlist/db";
import type { SendExtra } from "../telegram/messenger";
import { type CardDeps, renderItemCard } from "./card";
import { openAppKeyboard } from "./keyboards";
import { extractLinks, type MessageEntityLike } from "./links";
import { limitReachedText, NO_LINK_TEXT, NO_LISTS_TEXT } from "./texts";

export type AddLinksDeps = CardDeps & {
  db: Database;
  chatId: number;
  enqueueParse(job: ParseItemJob): Promise<void>;
  reply(text: string, extra: SendExtra): Promise<{ message_id: number }>;
};

export async function addLinksFromMessage(
  deps: AddLinksDeps,
  userId: string,
  text: string,
  entities: readonly MessageEntityLike[] = [],
): Promise<void> {
  const links = extractLinks(text, entities);
  if (links.length === 0) {
    await deps.reply(NO_LINK_TEXT, {});
    return;
  }
  const [list] = await listWishlistsForOwner(deps.db, userId);
  if (!list) {
    await deps.reply(NO_LISTS_TEXT, { reply_markup: openAppKeyboard(deps.appUrl) });
    return;
  }
  for (const sourceUrl of links) {
    const added = await addItem(deps.db, userId, list.id, { title: "", sourceUrl, priceKopecks: null, note: null, isMustHave: false });
    if (!added.ok) {
      await deps.reply(limitReachedText(list.title), {});
      return;
    }
    const card = await getBotItemCard(deps.db, added.itemId);
    if (!card) continue;
    const message = renderItemCard(card, deps);
    const sent = await deps.reply(message.text, message.extra);
    await deps.enqueueParse({ itemId: added.itemId, botMessage: { chatId: deps.chatId, messageId: sent.message_id } });
  }
}

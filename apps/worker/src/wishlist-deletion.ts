import { claimWishlistDeletionNotice, finishWishlistDeletionNotice, getWishlistDeletionTelegramId, retryWishlistDeletionNotice } from "@wishlist/db";
import type { DeliveryDeps } from "./delivery";
import { escapeHtml } from "./bot/texts";

export const WISHLIST_DELETION_CRON = "* * * * *";
const BATCH_SIZE = 25;

export async function runWishlistDeletionNotices(deps: DeliveryDeps): Promise<number> {
  let processed = 0;
  for (; processed < BATCH_SIZE; processed++) {
    const notice = await claimWishlistDeletionNotice(deps.db, deps.now());
    if (!notice) break;
    try {
      const telegramId = await getWishlistDeletionTelegramId(deps.db, notice);
      const text = `Список «${escapeHtml(notice.wishlistTitle)}» удалён владельцем. Ваши брони в нём больше не действуют. Если вы планировали покупать подарки, уточните планы у владельца.`;
      const outcome = telegramId === null ? "no_telegram" : await deps.messenger.send(telegramId, text);
      if (outcome === "failed") {
        await retryWishlistDeletionNotice(deps.db, notice, deps.now());
        deps.log("warn", "wishlist deletion notice scheduled for retry", { noticeId: notice.id, attempt: notice.attempts });
      } else {
        const completed = await finishWishlistDeletionNotice(deps.db, notice, deps.now(), outcome);
        deps.log(completed ? "info" : "warn", "wishlist deletion notice processed", { noticeId: notice.id, outcome, completed });
      }
    } catch {
      await retryWishlistDeletionNotice(deps.db, notice, deps.now());
      deps.log("warn", "wishlist deletion delivery interrupted", { noticeId: notice.id, attempt: notice.attempts });
    }
  }
  return processed;
}

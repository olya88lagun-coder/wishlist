import type { NotifyJob } from "@wishlist/core";
import { getActiveReservationNotice, type ReservationNotice } from "@wishlist/db";
import { guestReservedText, itemDeletedText, ownerReservedText, publicListUrl } from "./bot/texts";
import { type DeliveryDeps, type DeliveryOutcome, deliverNotification } from "./delivery";
import type { SendExtra } from "./telegram/messenger";

export type NotifyDeps = DeliveryDeps & { appUrl: string };

export function cancelReservationCallback(reservationId: string): string {
  return `cx:${reservationId}`;
}

function openListButton(appUrl: string, notice: ReservationNotice) {
  return { text: "Открыть список", url: publicListUrl(appUrl, notice.slug) };
}

function assertDelivered(outcome: DeliveryOutcome, kind: string): void {
  if (outcome === "failed") throw new Error(`telegram send failed: ${kind}`);
}

export async function runNotify(job: NotifyJob, deps: NotifyDeps): Promise<void> {
  const notice = await getActiveReservationNotice(deps.db, job.itemId);
  if (!notice) return;
  const openList: SendExtra = { reply_markup: { inline_keyboard: [[openListButton(deps.appUrl, notice)]] } };

  if (job.kind === "item_deleted") {
    if (!notice.guestUserId) return;
    const claim = { userId: notice.guestUserId, kind: "item_deleted" as const, refId: notice.reservationId };
    assertDelivered(await deliverNotification(deps, claim, itemDeletedText(notice), openList), claim.kind);
    return;
  }

  // Приватность: владелец узнаёт только сам факт брони, и не узнаёт ничего в режиме «Полный сюрприз»
  if (!notice.surpriseMode) {
    const claim = { userId: notice.ownerId, kind: "owner_reserved" as const, refId: notice.reservationId };
    assertDelivered(await deliverNotification(deps, claim, ownerReservedText(notice)), claim.kind);
  }
  if (notice.guestUserId) {
    const claim = { userId: notice.guestUserId, kind: "guest_reserved" as const, refId: notice.reservationId };
    const extra: SendExtra = {
      reply_markup: {
        inline_keyboard: [
          [openListButton(deps.appUrl, notice)],
          [{ text: "Снять бронь", callback_data: cancelReservationCallback(notice.reservationId) }],
        ],
      },
    };
    assertDelivered(await deliverNotification(deps, claim, guestReservedText(notice, deps.now()), extra), claim.kind);
  }
}

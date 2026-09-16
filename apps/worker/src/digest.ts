import { pluralRu, todayInTimeZone } from "@wishlist/core";
import { listUnannouncedReservations } from "@wishlist/db";
import { type DeliveryDeps, deliverNotification } from "./delivery";

export const OWNER_DIGEST_CRON = "0 21 * * *";
const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const GIFT_FORMS = ["подарок", "подарка", "подарков"] as const;

export function ownerDigestText(count: number): string {
  return `🎁 Сегодня в ваших списках забронировали ещё ${count} ${pluralRu(count, GIFT_FORMS)}. Кто и что — не скажем: пусть будет сюрприз.`;
}

// Окно — сутки до запуска: брони после вчерашней сводки, упёршиеся в лимит, попадают в сегодняшнюю
export async function runOwnerDigest(deps: DeliveryDeps): Promise<void> {
  const now = deps.now();
  const today = todayInTimeZone(now);
  const owners = await listUnannouncedReservations(deps.db, new Date(now.getTime() - DIGEST_WINDOW_MS));
  let sent = 0;
  for (const { ownerId, count } of owners) {
    const outcome = await deliverNotification(deps, { userId: ownerId, kind: "owner_digest", refId: today }, ownerDigestText(count));
    if (outcome === "sent") sent += 1;
  }
  deps.log("info", "owner digest processed", { day: today, owners: owners.length, sent });
}

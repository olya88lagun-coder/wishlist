import { todayInTimeZone } from "@wishlist/core";
import { claimNotification, type Database, getTelegramId, type NotificationClaim, releaseNotification } from "@wishlist/db";
import type { Logger } from "./log";
import type { Messenger, SendExtra, SendOutcome } from "./telegram/messenger";

export type DeliveryDeps = { db: Database; messenger: Messenger; now: () => Date; log: Logger };
export type DeliveryOutcome = SendOutcome | "no_telegram" | "skipped";

// Порядок: есть Telegram → место в дневном лимите → отправка. Временную ошибку откатываем, чтобы повтор смог отправить.
export async function deliverNotification(
  deps: DeliveryDeps,
  claim: NotificationClaim,
  text: string,
  extra: SendExtra = {},
): Promise<DeliveryOutcome> {
  const telegramId = await getTelegramId(deps.db, claim.userId);
  if (telegramId === null) return "no_telegram";
  if (!(await claimNotification(deps.db, claim, todayInTimeZone(deps.now())))) {
    deps.log("info", "notification skipped", { kind: claim.kind, refId: claim.refId, reason: "duplicate_or_daily_limit" });
    return "skipped";
  }
  const outcome = await deps.messenger.send(telegramId, text, extra);
  if (outcome === "rejected") deps.log("warn", "notification rejected by telegram", { kind: claim.kind, refId: claim.refId });
  if (outcome === "failed") await releaseNotification(deps.db, claim);
  return outcome;
}

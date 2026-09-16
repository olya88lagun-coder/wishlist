import { todayInTimeZone } from "@wishlist/core";
import { type DueReminder, listDueReminders } from "@wishlist/db";
import { publicListUrl, reminderText } from "./bot/texts";
import { type DeliveryDeps, deliverNotification } from "./delivery";

export const REMINDER_DAYS = [14, 7, 2] as const;
export const REMINDERS_CRON = "0 12 * * *";

export type ReminderDeps = DeliveryDeps & { appUrl: string };
export type ReminderStats = { guests: number; sent: number; skipped: number; failed: number };

function groupByGuest(reminders: readonly DueReminder[]): Map<string, DueReminder[]> {
  const groups = new Map<string, DueReminder[]>();
  for (const reminder of reminders) groups.set(reminder.guestUserId, [...(groups.get(reminder.guestUserId) ?? []), reminder]);
  return groups;
}

// Задача не бросает: иначе pg-boss повторил бы её целиком. Неотправленные видны в статистике и логе,
// а их место в лимите освобождено — повторный запуск в тот же день дошлёт только их.
export async function runReminders(deps: ReminderDeps): Promise<ReminderStats> {
  const today = todayInTimeZone(deps.now());
  const groups = groupByGuest(await listDueReminders(deps.db, today, REMINDER_DAYS));
  const stats: ReminderStats = { guests: groups.size, sent: 0, skipped: 0, failed: 0 };
  for (const [guestUserId, reminders] of groups) {
    const extra = { reply_markup: { inline_keyboard: [[{ text: "Открыть список", url: publicListUrl(deps.appUrl, reminders[0]!.slug) }]] } };
    const outcome = await deliverNotification(deps, { userId: guestUserId, kind: "reminder", refId: today }, reminderText(reminders), extra);
    if (outcome === "sent") stats.sent += 1;
    else if (outcome === "failed") stats.failed += 1;
    else stats.skipped += 1;
  }
  deps.log("info", "reminders processed", { day: today, ...stats });
  return stats;
}

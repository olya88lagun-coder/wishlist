import { signReminderPayload } from "@wishlist/core";

export function reminderBotLink(botUsername: string, reservationId: string, secret: string): string {
  return `https://t.me/${botUsername}?start=${signReminderPayload(reservationId, secret)}`;
}

import { verifyReminderPayload } from "@wishlist/core";
import { attachReservationToUser, type Database, upsertUserFromIdentity } from "@wishlist/db";
import type { SendExtra } from "../telegram/messenger";
import { openAppKeyboard } from "./keyboards";
import { attachResultText, START_TEXT } from "./texts";

export type TelegramFrom = { id: number; first_name: string; last_name?: string; username?: string };
export type BotReply = { text: string; extra: SendExtra };

// Тот же пользователь, что при входе в Mini App: identity telegram с тем же id
export async function ensureBotUser(db: Database, from: TelegramFrom): Promise<string> {
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const user = await upsertUserFromIdentity(db, { provider: "telegram", providerUserId: String(from.id), displayName, avatarUrl: null });
  return user.id;
}

export async function startReply(
  deps: { db: Database; appUrl: string; sessionSecret: string },
  from: TelegramFrom,
  payload: string,
): Promise<BotReply> {
  const userId = await ensureBotUser(deps.db, from);
  const keyboard = { reply_markup: openAppKeyboard(deps.appUrl) };
  if (!payload.startsWith("r")) return { text: START_TEXT, extra: keyboard };
  const reservationId = verifyReminderPayload(payload, deps.sessionSecret);
  if (!reservationId) return { text: attachResultText("bad_link"), extra: keyboard };
  return { text: attachResultText(await attachReservationToUser(deps.db, reservationId, userId)), extra: keyboard };
}

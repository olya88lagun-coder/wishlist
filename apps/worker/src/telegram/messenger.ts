import { type Api, GrammyError } from "grammy";
import type { InlineKeyboardMarkup, LinkPreviewOptions } from "grammy/types";

export type SendExtra = { reply_markup?: InlineKeyboardMarkup; link_preview_options?: LinkPreviewOptions };
export type SendOutcome = "sent" | "rejected" | "failed";

export type Messenger = {
  send(chatId: number, text: string, extra?: SendExtra): Promise<SendOutcome>;
  edit(chatId: number, messageId: number, text: string, extra?: SendExtra): Promise<SendOutcome>;
};

const NOT_MODIFIED = /message is not modified/i;

// 403 — пользователь не запускал бота или заблокировал его; 400 — чат или сообщение не найдены. Повтор не поможет.
export function outcomeOf(error: unknown): SendOutcome {
  if (error instanceof GrammyError) {
    if (error.error_code === 400 && NOT_MODIFIED.test(error.description)) return "sent";
    if (error.error_code === 400 || error.error_code === 403) return "rejected";
  }
  return "failed";
}

export function createMessenger(api: Api): Messenger {
  return {
    async send(chatId, text, extra = {}) {
      try {
        await api.sendMessage(chatId, text, { parse_mode: "HTML", ...extra });
        return "sent";
      } catch (error) {
        return outcomeOf(error);
      }
    },
    async edit(chatId, messageId, text, extra = {}) {
      try {
        await api.editMessageText(chatId, messageId, text, { parse_mode: "HTML", ...extra });
        return "sent";
      } catch (error) {
        return outcomeOf(error);
      }
    },
  };
}

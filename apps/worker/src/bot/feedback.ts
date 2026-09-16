export const FEEDBACK_START_PAYLOAD = "feedback";

export const FEEDBACK_PROMPT = "Что понравилось, что мешает или сломалось? Ответьте на это сообщение — прочитаю каждое.";
export const FEEDBACK_THANKS = "Спасибо! Передал. Если понадобится уточнить, напишу вам сюда.";

export type ReplyLike = { reply_to_message?: { from?: { id: number }; text?: string } };

export function isFeedbackReply(message: ReplyLike, botId: number): boolean {
  const original = message.reply_to_message;
  return original?.from?.id === botId && original.text === FEEDBACK_PROMPT;
}

export function feedbackHeader(from: { id: number; username?: string }): string {
  return from.username ? `📝 Отзыв от @${from.username} (id ${from.id}):` : `📝 Отзыв от id ${from.id}:`;
}

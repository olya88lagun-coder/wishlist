import { expect, test } from "vitest";
import { FEEDBACK_PROMPT, feedbackHeader, isFeedbackReply } from "./feedback";

const BOT_ID = 7000;

test("only replies to the bot's feedback question count as feedback", () => {
  expect(isFeedbackReply({ reply_to_message: { from: { id: BOT_ID }, text: FEEDBACK_PROMPT } }, BOT_ID)).toBe(true);
  expect(isFeedbackReply({ reply_to_message: { from: { id: BOT_ID }, text: "Карточка подарка" } }, BOT_ID)).toBe(false);
  expect(isFeedbackReply({ reply_to_message: { from: { id: 1 }, text: FEEDBACK_PROMPT } }, BOT_ID)).toBe(false);
  expect(isFeedbackReply({}, BOT_ID)).toBe(false);
});

test("the admin sees who wrote, to be able to answer", () => {
  expect(feedbackHeader({ id: 555, username: "olya" })).toBe("📝 Отзыв от @olya (id 555):");
  expect(feedbackHeader({ id: 555 })).toBe("📝 Отзыв от id 555:");
});

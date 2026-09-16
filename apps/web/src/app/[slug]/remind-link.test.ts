import { verifyReminderPayload } from "@wishlist/core";
import { expect, test } from "vitest";
import { reminderBotLink } from "./remind-link";

test("links to the bot with a signed start parameter", () => {
  const secret = "s".repeat(32);
  const id = "3c5e5e81-358d-4c3d-b4ed-100bac8fea49";
  const link = new URL(reminderBotLink("my_wish_list1_bot", id, secret));
  expect(`${link.origin}${link.pathname}`).toBe("https://t.me/my_wish_list1_bot");
  expect(verifyReminderPayload(link.searchParams.get("start") ?? "", secret)).toBe(id);
});

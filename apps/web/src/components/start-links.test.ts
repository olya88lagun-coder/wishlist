import { expect, test } from "vitest";
import { GUEST_START_PAYLOAD, startLinks } from "./start-links";

test("visitors without an account can start in Telegram or on the site", () => {
  expect(startLinks("my_wish_list1_bot", false)).toEqual([
    { id: "telegram", label: "Собрать в Telegram", href: `https://t.me/my_wish_list1_bot?start=${GUEST_START_PAYLOAD}`, external: true },
    { id: "site", label: "Собрать на сайте", href: "/login", external: false },
  ]);
});

test("signed-in visitors go straight to their lists", () => {
  expect(startLinks("my_wish_list1_bot", true)).toEqual([{ id: "lists", label: "Открыть мои списки", href: "/lists", external: false }]);
});

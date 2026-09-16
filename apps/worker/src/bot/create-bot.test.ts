import { expect, test } from "vitest";
import { isLocalAppUrl } from "./create-bot";

test("local app urls disable the bot, a real domain keeps it", () => {
  expect(isLocalAppUrl("http://localhost:3000")).toBe(true);
  expect(isLocalAppUrl("http://127.0.0.1:3000")).toBe(true);
  expect(isLocalAppUrl("https://my-wish-list.online")).toBe(false);
});

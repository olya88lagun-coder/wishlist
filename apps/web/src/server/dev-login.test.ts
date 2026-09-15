import { expect, test } from "vitest";
import { isDevLoginEnabled } from "./dev-login";

test("dev login is only available outside production with an explicit flag", () => {
  expect(isDevLoginEnabled({ NODE_ENV: "development", DEV_LOGIN: "1" })).toBe(true);
  expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(false);
  expect(isDevLoginEnabled({ NODE_ENV: "production", DEV_LOGIN: "1" })).toBe(false);
});

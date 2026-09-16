import { expect, test } from "vitest";
import { GO_COOKIE_MAX_AGE_SECONDS, goCookieName, isSafeRedirect } from "./go-cookie";

test("one short cookie name per item", () => {
  expect(goCookieName("3c5e5e81-358d-4c3d-b4ed-100bac8fea49")).toBe("wl_go_3c5e5e81358d");
  expect(GO_COOKIE_MAX_AGE_SECONDS).toBe(86400);
});

test("only web links are followed", () => {
  expect(isSafeRedirect("https://www.wildberries.ru/catalog/1/detail.aspx")).toBe(true);
  expect(isSafeRedirect("http://shop.ru/p/1")).toBe(true);
  expect(isSafeRedirect("javascript:alert(1)")).toBe(false);
  expect(isSafeRedirect("data:text/html,hi")).toBe(false);
  expect(isSafeRedirect("не ссылка")).toBe(false);
});

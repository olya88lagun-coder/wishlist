import type { PublicWishlistView } from "@wishlist/db";
import { expect, test } from "vitest";
import { OG_TITLE_MAX, ogModel } from "./og-model";

const NOW = new Date("2026-10-01T09:00:00Z");

const view = (over: Partial<PublicWishlistView> = {}): Pick<PublicWishlistView, "wishlist" | "ownerName" | "items"> => ({
  wishlist: { id: "w1", title: "Маше 30", occasion: "birthday", eventDate: "2026-10-08", slug: "AbCdEfGhIj" },
  ownerName: "Маша",
  items: [],
  ...over,
});

const gifts = (count: number) => Array.from({ length: count }) as PublicWishlistView["items"];

test("describes the list the way the page does", () => {
  expect(ogModel(view({ items: gifts(3) }), NOW)).toEqual({
    eyebrow: "список Маши",
    title: "Маше 30",
    items: "3 подарка",
    countdown: "ДР через 7 дней",
  });
});

test("counts gifts and days in Russian", () => {
  expect(ogModel(view(), NOW).items).toBe("пока без подарков");
  expect(ogModel(view({ items: gifts(1) }), NOW).items).toBe("1 подарок");
  expect(ogModel(view({ items: gifts(11) }), NOW).items).toBe("11 подарков");
  expect(ogModel(view({ wishlist: { ...view().wishlist, occasion: "new_year", eventDate: "2026-10-02" } }), NOW).countdown).toBe(
    "Новый год через 1 день",
  );
});

test("no date and past dates leave the countdown out", () => {
  expect(ogModel(view({ wishlist: { ...view().wishlist, eventDate: null } }), NOW).countdown).toBeNull();
  expect(ogModel(view({ wishlist: { ...view().wishlist, eventDate: "2026-09-30" } }), NOW).countdown).toBeNull();
});

test("long titles are cut on a word boundary and owner names keep the genitive", () => {
  const long = "Очень длинное название списка про большой семейный праздник и много гостей";
  const model = ogModel(view({ wishlist: { ...view().wishlist, title: long }, ownerName: "Оля" }), NOW);
  expect(model.title.length).toBeLessThanOrEqual(OG_TITLE_MAX + 1);
  expect(model.title.endsWith("…")).toBe(true);
  expect(model.title).not.toContain("  ");
  expect(model.eyebrow).toBe("список Оли");
});

test("male names keep the plain form", () => {
  expect(ogModel(view({ ownerName: "Пётр" }), NOW).eyebrow).toBe("список: Пётр");
});

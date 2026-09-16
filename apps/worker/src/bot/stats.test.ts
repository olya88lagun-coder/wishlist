import type { AdminStats } from "@wishlist/db";
import { expect, test } from "vitest";
import { percent, STATS_WINDOW_DAYS, statsText } from "./stats";

const stats: AdminStats = {
  users: { total: 40, new: 12 },
  wishlists: { total: 25, new: 9, withThreeItems: 10, withReservations: 5 },
  items: { new: 130 },
  reservations: { new: 17 },
  storeVisits: { new: 21, byStore: [{ store: "wildberries", count: 15 }, { store: "ozon", count: 6 }] },
  themeInterest: 4,
};

test("a compact report for the admin", () => {
  expect(STATS_WINDOW_DAYS).toBe(7);
  expect(statsText(stats)).toBe(
    [
      "📊 За 7 дней (всего)",
      "Пользователи: +12 (40)",
      "Списки: +9 (25), с 3+ подарками: 10 (40%), с бронями: 5 (20%)",
      "Подарки: +130",
      "Брони: +17",
      "Переходы в магазин: +21 — wildberries 15, ozon 6",
      "Хотят оформление: 4",
    ].join("\n"),
  );
});

test("no visits yet", () => {
  expect(statsText({ ...stats, storeVisits: { new: 0, byStore: [] } })).toContain("Переходы в магазин: +0");
});

test("percentages survive an empty database", () => {
  expect(percent(3, 0)).toBe("—");
  expect(percent(1, 3)).toBe("33%");
});

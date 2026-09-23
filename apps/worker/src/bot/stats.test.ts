import type { AdminStats } from "@wishlist/db";
import { expect, test } from "vitest";
import { percent, rub, STATS_WINDOW_DAYS, statsText } from "./stats";

const stats: AdminStats = {
  users: { total: 40, new: 12 },
  wishlists: { total: 25, new: 9, withThreeItems: 10, withReservations: 5 },
  items: { new: 130 },
  reservations: { new: 17 },
  storeVisits: { new: 21, byStore: [{ store: "wildberries", count: 15 }, { store: "ozon", count: 6 }] },
  storeSearches: {
    new: 30,
    byStore: [{ store: "ozon", count: 18 }, { store: "wildberries", count: 12 }],
    topSources: [{ source: "gifts/for-mom", count: 14 }, { source: "finder", count: 9 }],
  },
  ai: { requests: 60, attempts: 70, failedAttempts: 7, costMicroRub: 900_000 },
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
      "Переходы в магазин из списков: +21 — wildberries 15, ozon 6",
      "Переходы из идей и подборщика: +30 — ozon 18, wildberries 12",
      "Откуда: gifts/for-mom 14, finder 9",
      "AI: 60 подборок, 70 попыток, неудачных 7 (10%)",
      "AI расход: 0,90 ₽, на подборку 0,015 ₽, на переход 0,030 ₽",
      "Хотят оформление: 4",
    ].join("\n"),
  );
});

test("an empty week has no division by zero and no empty source line", () => {
  const text = statsText({
    ...stats,
    storeVisits: { new: 0, byStore: [] },
    storeSearches: { new: 0, byStore: [], topSources: [] },
    ai: { requests: 0, attempts: 0, failedAttempts: 0, costMicroRub: 0 },
  });
  expect(text).toContain("Переходы в магазин из списков: +0");
  expect(text).toContain("Переходы из идей и подборщика: +0");
  expect(text).not.toContain("Откуда:");
  expect(text).toContain("AI: 0 подборок, 0 попыток, неудачных 0 (—)");
  expect(text).toContain("AI расход: 0,00 ₽, на подборку —, на переход —");
});

test("percentages survive an empty database", () => {
  expect(percent(3, 0)).toBe("—");
  expect(percent(1, 3)).toBe("33%");
});

test("roubles are shown with a comma and two decimals", () => {
  expect(rub(13_950)).toBe("0,01 ₽");
  expect(rub(50_000_000)).toBe("50,00 ₽");
  expect(rub(13_950, 3)).toBe("0,014 ₽");
});

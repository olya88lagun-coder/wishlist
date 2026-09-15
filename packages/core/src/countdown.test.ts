import { describe, expect, test } from "vitest";
import { countdownLabel, daysUntil, pluralRu, todayInTimeZone } from "./countdown";

describe("todayInTimeZone", () => {
  test("uses Moscow date even when UTC is still the previous day", () => {
    expect(todayInTimeZone(new Date("2026-03-13T22:30:00Z"))).toBe("2026-03-14");
    expect(todayInTimeZone(new Date("2026-03-13T20:30:00Z"))).toBe("2026-03-13");
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-03-02T09:00:00Z");
  test("counts whole days to a future date", () => {
    expect(daysUntil("2026-03-14", now)).toBe(12);
    expect(daysUntil("2026-03-03", now)).toBe(1);
  });
  test("returns 0 on the event day", () => {
    expect(daysUntil("2026-03-02", now)).toBe(0);
  });
  test("returns null for past or missing dates", () => {
    expect(daysUntil("2026-03-01", now)).toBeNull();
    expect(daysUntil(null, now)).toBeNull();
  });
  test("handles year boundaries", () => {
    expect(daysUntil("2027-01-01", new Date("2026-12-31T10:00:00Z"))).toBe(1);
  });
});

describe("pluralRu", () => {
  const forms = ["день", "дня", "дней"] as const;
  test.each([
    [1, "день"], [2, "дня"], [4, "дня"], [5, "дней"], [11, "дней"], [12, "дней"],
    [14, "дней"], [21, "день"], [22, "дня"], [25, "дней"], [111, "дней"], [101, "день"],
  ])("%i → %s", (n, expected) => {
    expect(pluralRu(n, forms)).toBe(expected);
  });
});

describe("countdownLabel", () => {
  test("birthday phrasing", () => {
    expect(countdownLabel("birthday", 12)).toBe("ДР через 12 дней");
    expect(countdownLabel("birthday", 1)).toBe("ДР завтра");
    expect(countdownLabel("birthday", 0)).toBe("ДР сегодня");
  });
  test("new year and other occasions", () => {
    expect(countdownLabel("new_year", 3)).toBe("Новый год через 3 дня");
    expect(countdownLabel("other", 21)).toBe("Праздник через 21 день");
    expect(countdownLabel("other", 0)).toBe("Праздник сегодня");
  });
});

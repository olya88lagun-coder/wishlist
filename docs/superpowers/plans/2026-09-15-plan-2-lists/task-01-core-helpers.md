# Task 1: Вспомогательные функции ядра (`packages/core`)

**Files:**
- Create: `packages/core/src/slug.ts`, `packages/core/src/countdown.ts`, `packages/core/src/money.ts`, `packages/core/src/store.ts`
- Test: `packages/core/src/slug.test.ts`, `packages/core/src/countdown.test.ts`, `packages/core/src/money.test.ts`, `packages/core/src/store.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: ничего.
- Produces:
  ```ts
  // slug.ts
  const SLUG_LENGTH = 10;
  function generateSlug(): string;                 // [0-9A-Za-z]{10}
  function isValidSlug(value: string): boolean;
  // countdown.ts
  type Occasion = "birthday" | "new_year" | "other";
  const EVENT_TIME_ZONE = "Europe/Moscow";
  function todayInTimeZone(now: Date, timeZone?: string): string;          // "YYYY-MM-DD"
  function daysUntil(eventDate: string | null, now: Date, timeZone?: string): number | null; // null если даты нет или она прошла
  function pluralRu(n: number, forms: readonly [string, string, string]): string;
  function countdownLabel(occasion: Occasion, days: number): string;       // "ДР через 12 дней" | "ДР сегодня" | "ДР завтра"
  // money.ts
  const MAX_PRICE_RUBLES = 10_000_000;
  function parseRublesToKopecks(input: string): number | null;   // пустая строка → null; мусор → NaN-safe null
  function formatKopecks(kopecks: number): string;                // "24 990 ₽" (неразрывные пробелы)
  // store.ts
  type StoreId = "wildberries" | "ozon" | "goldapple" | "lamoda" | "yandex_market" | "other";
  type StoreInfo = { id: StoreId; label: string };
  const MAX_URL_LENGTH = 2048;
  function normalizeProductUrl(raw: string): string | null;       // только http(s), без utm/клик-меток и #hash
  function detectStore(url: string): StoreInfo;
  ```

- [x] **Step 1: Падающие тесты**

`packages/core/src/slug.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { generateSlug, isValidSlug, SLUG_LENGTH } from "./slug";

describe("generateSlug", () => {
  test("produces 10 url-safe alphanumeric characters", () => {
    for (let i = 0; i < 200; i++) expect(generateSlug()).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(SLUG_LENGTH).toBe(10);
  });

  test("does not repeat across many generations", () => {
    const seen = new Set(Array.from({ length: 5000 }, generateSlug));
    expect(seen.size).toBe(5000);
  });
});

describe("isValidSlug", () => {
  test("accepts generated slugs and rejects everything else", () => {
    expect(isValidSlug(generateSlug())).toBe(true);
    expect(isValidSlug("abc")).toBe(false);
    expect(isValidSlug("abcdefghi!")).toBe(false);
    expect(isValidSlug("login")).toBe(false);
  });
});
```

`packages/core/src/countdown.test.ts`:
```ts
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
```

`packages/core/src/money.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { formatKopecks, parseRublesToKopecks } from "./money";

describe("parseRublesToKopecks", () => {
  test.each([
    ["24990", 2499000],
    ["24 990", 2499000],
    ["24 990", 2499000],
    ["1990,50", 199050],
    ["1990.5", 199050],
    ["  700 ₽ ", 70000],
    ["0", 0],
  ])("%s → %i", (input, expected) => {
    expect(parseRublesToKopecks(input)).toBe(expected);
  });

  test.each([[""], ["   "], ["abc"], ["-5"], ["1.234"], ["10000001"], ["12,3,4"]])("rejects %j", (input) => {
    expect(parseRublesToKopecks(input)).toBeNull();
  });
});

describe("formatKopecks", () => {
  test("formats whole rubles with non-breaking group separators", () => {
    expect(formatKopecks(2499000)).toBe("24 990 ₽");
    expect(formatKopecks(70000)).toBe("700 ₽");
  });
  test("keeps kopecks when present", () => {
    expect(formatKopecks(199050)).toBe("1 990,50 ₽");
  });
});
```

`packages/core/src/store.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { detectStore, normalizeProductUrl } from "./store";

describe("normalizeProductUrl", () => {
  test("strips tracking params and hash, lowercases host", () => {
    expect(
      normalizeProductUrl("https://WWW.Wildberries.ru/catalog/173937886/detail.aspx?utm_source=tg&size=42&fbclid=x#reviews"),
    ).toBe("https://www.wildberries.ru/catalog/173937886/detail.aspx?size=42");
  });

  test("trims whitespace and accepts http", () => {
    expect(normalizeProductUrl("  http://lamoda.ru/p/abc/  ")).toBe("http://lamoda.ru/p/abc/");
  });

  test("rejects non-http schemes, garbage and very long urls", () => {
    expect(normalizeProductUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeProductUrl("ftp://example.com/a")).toBeNull();
    expect(normalizeProductUrl("просто текст")).toBeNull();
    expect(normalizeProductUrl(`https://example.com/${"a".repeat(2100)}`)).toBeNull();
  });
});

describe("detectStore", () => {
  test.each([
    ["https://www.wildberries.ru/catalog/1/detail.aspx", "wildberries", "Wildberries"],
    ["https://wb.ru/catalog/1/detail.aspx", "wildberries", "Wildberries"],
    ["https://www.ozon.ru/product/x-1/", "ozon", "Ozon"],
    ["https://goldapple.ru/19000238593-search", "goldapple", "Золотое Яблоко"],
    ["https://www.lamoda.ru/p/rtlabq944601/", "lamoda", "Lamoda"],
    ["https://market.yandex.ru/product--x/1", "yandex_market", "Яндекс Маркет"],
  ])("%s → %s", (url, id, label) => {
    expect(detectStore(url)).toEqual({ id, label });
  });

  test("falls back to the bare host for unknown shops", () => {
    expect(detectStore("https://www.letu.ru/product/1")).toEqual({ id: "other", label: "letu.ru" });
  });
});
```

- [x] **Step 2: Тесты падают**

Run: `pnpm vitest run packages/core/src/slug.test.ts packages/core/src/countdown.test.ts packages/core/src/money.test.ts packages/core/src/store.test.ts`
Expected: FAIL — `Cannot find module './slug'` (и остальные).

- [x] **Step 3: Реализация**

`packages/core/src/slug.ts`:
```ts
import { randomBytes } from "node:crypto";

export const SLUG_LENGTH = 10;
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
// 248 = наибольшее кратное 62, не превышающее 256: отбрасываем остальные байты, чтобы не было смещения
const UNBIASED_LIMIT = 248;

export function generateSlug(): string {
  let slug = "";
  while (slug.length < SLUG_LENGTH) {
    for (const byte of randomBytes(SLUG_LENGTH * 2)) {
      if (byte < UNBIASED_LIMIT && slug.length < SLUG_LENGTH) slug += ALPHABET[byte % ALPHABET.length];
    }
  }
  return slug;
}

export function isValidSlug(value: string): boolean {
  return /^[0-9A-Za-z]{10}$/.test(value);
}
```

`packages/core/src/countdown.ts`:
```ts
export type Occasion = "birthday" | "new_year" | "other";

export const EVENT_TIME_ZONE = "Europe/Moscow";
const MS_PER_DAY = 86_400_000;
const DAY_FORMS = ["день", "дня", "дней"] as const;
const OCCASION_TITLE: Record<Occasion, string> = { birthday: "ДР", new_year: "Новый год", other: "Праздник" };

export function todayInTimeZone(now: Date, timeZone = EVENT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtcDay(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function daysUntil(eventDate: string | null, now: Date, timeZone = EVENT_TIME_ZONE): number | null {
  if (!eventDate) return null;
  const days = Math.round((toUtcDay(eventDate) - toUtcDay(todayInTimeZone(now, timeZone))) / MS_PER_DAY);
  return days < 0 ? null : days;
}

export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function countdownLabel(occasion: Occasion, days: number): string {
  const title = OCCASION_TITLE[occasion];
  if (days === 0) return `${title} сегодня`;
  if (days === 1 && occasion === "birthday") return `${title} завтра`;
  return `${title} через ${days} ${pluralRu(days, DAY_FORMS)}`;
}
```

`packages/core/src/money.ts`:
```ts
export const MAX_PRICE_RUBLES = 10_000_000;
const KOPECKS_PER_RUBLE = 100;
const rublesFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const rublesWithKopecksFormatter = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function parseRublesToKopecks(input: string): number | null {
  const cleaned = input.replace(/[\s  ₽]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const kopecks = Number(whole) * KOPECKS_PER_RUBLE + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(kopecks) || kopecks > MAX_PRICE_RUBLES * KOPECKS_PER_RUBLE) return null;
  return kopecks;
}

export function formatKopecks(kopecks: number): string {
  const rubles = kopecks / KOPECKS_PER_RUBLE;
  const formatter = kopecks % KOPECKS_PER_RUBLE === 0 ? rublesFormatter : rublesWithKopecksFormatter;
  // ru-RU в Node использует U+00A0 как разделитель групп; приводим к нему явно на случай U+202F
  return `${formatter.format(rubles).replace(/ /g, " ")} ₽`;
}
```

`packages/core/src/store.ts`:
```ts
export type StoreId = "wildberries" | "ozon" | "goldapple" | "lamoda" | "yandex_market" | "other";
export type StoreInfo = { id: StoreId; label: string };

export const MAX_URL_LENGTH = 2048;

const TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|yclid|_openstat|erid)$/i;

const KNOWN_STORES: { id: Exclude<StoreId, "other">; label: string; hosts: string[] }[] = [
  { id: "wildberries", label: "Wildberries", hosts: ["wildberries.ru", "wb.ru"] },
  { id: "ozon", label: "Ozon", hosts: ["ozon.ru"] },
  { id: "goldapple", label: "Золотое Яблоко", hosts: ["goldapple.ru"] },
  { id: "lamoda", label: "Lamoda", hosts: ["lamoda.ru"] },
  { id: "yandex_market", label: "Яндекс Маркет", hosts: ["market.yandex.ru"] },
];

export function normalizeProductUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  url.hash = "";
  return url.toString();
}

function bareHost(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

export function detectStore(url: string): StoreInfo {
  const host = bareHost(url);
  const known = KNOWN_STORES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return known ? { id: known.id, label: known.label } : { id: "other", label: host };
}
```

`packages/core/src/index.ts`:
```ts
export * from "./reservations";
export * from "./auth/telegram";
export * from "./auth/session";
export * from "./auth/vk";
export * from "./slug";
export * from "./countdown";
export * from "./money";
export * from "./store";
```

- [x] **Step 4: Тесты проходят**

Run: `pnpm vitest run packages/core && pnpm typecheck`
Expected: PASS. Если тест `formatKopecks` падает только на разделителе — вывести фактическую строку через `JSON.stringify` и сверить код символа (Node может отдавать U+00A0 или U+202F; реализация нормализует к U+00A0).

- [x] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): slug, countdown, money and store helpers"
```

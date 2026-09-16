# Task 3: Тексты бота и поиск ссылок в сообщении

**Files:**
- Create: `apps/worker/src/bot/links.ts`, `apps/worker/src/bot/texts.ts`
- Test: `apps/worker/src/bot/links.test.ts`, `apps/worker/src/bot/texts.test.ts`

**Interfaces:**
- Consumes: из `@wishlist/core` — `normalizeProductUrl`, `detectStore`, `formatKopecks`, `countdownLabel`, `daysUntil`, `pluralRu`; типы `ReservationNotice`, `DueReminder`, `BotItemCard` из `@wishlist/db` (Tasks 1–2).
- Produces:
  ```ts
  // bot/links.ts
  const MAX_LINKS_PER_MESSAGE = 5;
  type MessageEntityLike = { type: string; offset: number; length: number; url?: string };
  function extractLinks(text: string, entities?: readonly MessageEntityLike[]): string[];
  // bot/texts.ts
  function escapeHtml(text: string): string;
  function publicListUrl(appUrl: string, slug: string): string;
  function miniAppUrl(appUrl: string, path?: string): string;          // `${APP_URL}/tg?next=<path>`
  const START_TEXT: string; const NO_LINK_TEXT: string; const NO_LISTS_TEXT: string;
  function limitReachedText(wishlistTitle: string): string;
  function attachResultText(result: AttachResult | "bad_link"): string;
  function itemCardText(card: BotItemCard): string;
  function itemDeletedByOwnerText(card: Pick<BotItemCard, "title" | "wishlistTitle">): string;
  function ownerReservedText(notice: ReservationNotice): string;
  function guestReservedText(notice: ReservationNotice, now: Date): string;
  function itemDeletedText(notice: ReservationNotice): string;
  function reminderText(reminders: readonly DueReminder[]): string;
  const RESERVATION_CANCELLED_TEXT: string;
  ```

Все тексты уходят с `parse_mode: "HTML"`, поэтому пользовательские строки (названия подарков и списков, имена) проходят через `escapeHtml`.

- [x] **Step 1: Тест ссылок (падает)**

`apps/worker/src/bot/links.test.ts`:
```ts
import { expect, test } from "vitest";
import { extractLinks, MAX_LINKS_PER_MESSAGE } from "./links";

test("takes links from Telegram entities, including text links and links without a scheme", () => {
  const text = "Хочу вот это wb.ru/catalog/1/detail.aspx и ещё";
  expect(
    extractLinks(text, [
      { type: "url", offset: 13, length: 27 },
      { type: "text_link", offset: 43, length: 3, url: "https://goldapple.ru/19000378828-cardamom-moss?utm_source=tg" },
    ]),
  ).toEqual(["https://wb.ru/catalog/1/detail.aspx", "https://goldapple.ru/19000378828-cardamom-moss"]);
});

test("falls back to searching the text and trims trailing punctuation", () => {
  expect(extractLinks("Смотри: https://www.ozon.ru/product/igrushka-123456/.")).toEqual(["https://www.ozon.ru/product/igrushka-123456/"]);
  expect(extractLinks("(https://market.yandex.ru/cc/B4wQYn)")).toEqual(["https://market.yandex.ru/cc/B4wQYn"]);
});

test("deduplicates, ignores non-http links and caps the count", () => {
  const many = Array.from({ length: 8 }, (_, i) => `https://shop.ru/p/${i}`).join(" ");
  expect(extractLinks(many)).toHaveLength(MAX_LINKS_PER_MESSAGE);
  expect(extractLinks("https://shop.ru/p/1 https://shop.ru/p/1#reviews")).toEqual(["https://shop.ru/p/1"]);
  expect(extractLinks("просто текст без ссылок, tg://resolve?domain=x")).toEqual([]);
});
```

Run: `pnpm vitest run apps/worker/src/bot/links.test.ts`
Expected: FAIL — `Failed to resolve import "./links"`.

- [x] **Step 2: Ссылки**

`apps/worker/src/bot/links.ts`:
```ts
import { normalizeProductUrl } from "@wishlist/core";

export const MAX_LINKS_PER_MESSAGE = 5;

export type MessageEntityLike = { type: string; offset: number; length: number; url?: string };

const URL_IN_TEXT = /https?:\/\/[^\s<>"«»]+/gi;
const TRAILING_PUNCTUATION = /[).,!?;:]+$/;

// Смещения сущностей Telegram — в UTF-16, как и индексы строк JS, поэтому slice попадает точно
function candidates(text: string, entities: readonly MessageEntityLike[]): string[] {
  const fromEntities = entities.flatMap((entity) => {
    if (entity.type === "text_link" && entity.url) return [entity.url];
    if (entity.type === "url") return [text.slice(entity.offset, entity.offset + entity.length)];
    return [];
  });
  return fromEntities.length > 0 ? fromEntities : (text.match(URL_IN_TEXT) ?? []);
}

export function extractLinks(text: string, entities: readonly MessageEntityLike[] = []): string[] {
  const links: string[] = [];
  for (const raw of candidates(text, entities)) {
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = normalizeProductUrl(withScheme);
    if (url && !links.includes(url)) links.push(url);
    if (links.length === MAX_LINKS_PER_MESSAGE) break;
  }
  return links;
}
```

Run: `pnpm vitest run apps/worker/src/bot/links.test.ts`
Expected: PASS (3 теста). Если падает дедупликация с `#reviews` — `normalizeProductUrl` убирает `hash`, проверить, что сравнение идёт после нормализации.

- [x] **Step 3: Тест текстов (падает)**

`apps/worker/src/bot/texts.test.ts`:
```ts
import type { BotItemCard, DueReminder, ReservationNotice } from "@wishlist/db";
import { describe, expect, test } from "vitest";
import {
  attachResultText,
  escapeHtml,
  guestReservedText,
  itemCardText,
  itemDeletedText,
  miniAppUrl,
  ownerReservedText,
  publicListUrl,
  reminderText,
} from "./texts";

const APP = "https://my-wish-list.online";
const NOW = new Date("2026-10-01T09:00:00Z");

const card: BotItemCard = {
  id: "i1",
  ownerId: "o1",
  wishlistId: "w1",
  wishlistTitle: "ДР <30>",
  title: "Наушники & чехол",
  sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx",
  priceKopecks: 147200,
  imageKey: "items/i1/p.webp",
  parseStatus: "ok",
  deleted: false,
};

const notice: ReservationNotice = {
  reservationId: "r1",
  guestUserId: "g1",
  itemTitle: "Свеча",
  wishlistTitle: "Маше 30",
  slug: "AbCdEfGhIj",
  occasion: "birthday",
  eventDate: "2026-10-08",
  ownerId: "o1",
  ownerName: "Маша",
  surpriseMode: false,
};

test("urls and escaping", () => {
  expect(escapeHtml(`<b>"Tom & Jerry"</b>`)).toBe(`&lt;b&gt;"Tom &amp; Jerry"&lt;/b&gt;`);
  expect(publicListUrl(APP, "AbCdEfGhIj")).toBe("https://my-wish-list.online/AbCdEfGhIj");
  expect(miniAppUrl(APP)).toBe("https://my-wish-list.online/tg?next=%2Flists");
  expect(miniAppUrl(APP, "/lists/w1")).toBe("https://my-wish-list.online/tg?next=%2Flists%2Fw1");
});

describe("itemCardText", () => {
  test("complete card shows title, price with store and the list", () => {
    expect(itemCardText(card)).toBe("<b>Наушники &amp; чехол</b>\n1 472 ₽ · Wildberries\nВ списке «ДР &lt;30&gt;»");
  });

  test("pending card says data is loading", () => {
    expect(itemCardText({ ...card, title: "", priceKopecks: null, parseStatus: "pending" })).toBe(
      "<i>Загружаем данные из магазина…</i>\nWildberries\nВ списке «ДР &lt;30&gt;»",
    );
  });

  test("partial and failed cards ask only for what is missing", () => {
    expect(itemCardText({ ...card, priceKopecks: null, parseStatus: "partial" })).toContain("Магазин не отдал цену — впишите её в приложении");
    expect(itemCardText({ ...card, title: "", priceKopecks: null, parseStatus: "failed" })).toContain(
      "<b>Подарок без названия</b>",
    );
    expect(itemCardText({ ...card, title: "", priceKopecks: null, parseStatus: "failed" })).toContain(
      "Магазин не отдал название и цену — впишите их в приложении",
    );
  });
});

describe("notices", () => {
  test("owner is told that someone reserved, without any guest details", () => {
    const text = ownerReservedText(notice);
    expect(text).toBe("🎁 Кто-то забронировал «Свеча» из списка «Маше 30». Кто — не скажем: пусть будет сюрприз.");
  });

  test("guest gets a confirmation with the countdown and reminder promise", () => {
    expect(guestReservedText(notice, NOW)).toBe("Готово! Вы дарите «Свеча» для Маша.\nДР через 7 дней. Напомню за 14, 7 и 2 дня.");
    expect(guestReservedText({ ...notice, eventDate: null }, NOW)).toBe("Готово! Вы дарите «Свеча» для Маша.");
  });

  test("guest learns that the reserved item was deleted", () => {
    expect(itemDeletedText(notice)).toBe("Маша удалил(а) «Свеча» из списка «Маше 30» — бронь больше не нужна. Можно выбрать другой подарок.");
  });

  test("attach results", () => {
    expect(attachResultText("attached")).toBe("Готово! Напомню о подарке за 14, 7 и 2 дня до праздника.");
    expect(attachResultText("already_yours")).toBe("Напоминания уже включены.");
    expect(attachResultText("taken")).toBe("Эту бронь уже привязали к другому аккаунту Telegram.");
    expect(attachResultText("not_found")).toBe("Бронь не найдена — возможно, её уже сняли.");
    expect(attachResultText("bad_link")).toBe("Ссылка устарела. Откройте список и нажмите «Напомнить в Telegram» ещё раз.");
  });
});

test("reminders of one day are merged into one message", () => {
  const reminders: DueReminder[] = [
    { guestUserId: "g1", itemTitle: "Свеча", wishlistTitle: "Маше 30", slug: "AbCdEfGhIj", occasion: "birthday", ownerName: "Маша", daysLeft: 7 },
    { guestUserId: "g1", itemTitle: "Шарф", wishlistTitle: "Новый год", slug: "KlMnOpQrSt", occasion: "new_year", ownerName: "Петя", daysLeft: 2 },
  ];
  expect(reminderText(reminders)).toBe(
    "Напоминание о подарках 🎁\n• ДР через 7 дней у Маша — вы дарите «Свеча»\n• Новый год через 2 дня у Петя — вы дарите «Шарф»",
  );
});
```

Run: `pnpm vitest run apps/worker/src/bot/texts.test.ts`
Expected: FAIL — `Failed to resolve import "./texts"`.

- [x] **Step 4: Тексты**

`apps/worker/src/bot/texts.ts`:
```ts
import { countdownLabel, daysUntil, detectStore, formatKopecks } from "@wishlist/core";
import type { AttachResult, BotItemCard, DueReminder, ReservationNotice } from "@wishlist/db";

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function publicListUrl(appUrl: string, slug: string): string {
  return new URL(`/${slug}`, appUrl).toString();
}

// Mini App открывается на /tg: там вход по initData, затем переход на next
export function miniAppUrl(appUrl: string, path = "/lists"): string {
  return `${new URL("/tg", appUrl).toString()}?next=${encodeURIComponent(path)}`;
}

export const START_TEXT =
  "Привет! Я помогу собрать вишлист.\n\nПришлите ссылку на товар из любого магазина — добавлю его в ваш список с фото и ценой. Списки, бронирования и настройки — в приложении.";

export const NO_LINK_TEXT =
  "Не нашёл ссылку. Пришлите ссылку на товар — например, в приложении Wildberries нажмите «Поделиться» → «Скопировать».";

export const NO_LISTS_TEXT = "Сначала создайте список в приложении — потом присылайте ссылки, и я буду добавлять подарки в него.";

export const RESERVATION_CANCELLED_TEXT = "Бронь снята — подарок снова свободен.";

const REMINDER_PROMISE = "Напомню за 14, 7 и 2 дня.";

export function limitReachedText(wishlistTitle: string): string {
  return `В списке «${escapeHtml(wishlistTitle)}» уже максимум подарков. Перенесите или удалите лишние в приложении.`;
}

const ATTACH_TEXTS: Record<AttachResult | "bad_link", string> = {
  attached: "Готово! Напомню о подарке за 14, 7 и 2 дня до праздника.",
  already_yours: "Напоминания уже включены.",
  taken: "Эту бронь уже привязали к другому аккаунту Telegram.",
  not_found: "Бронь не найдена — возможно, её уже сняли.",
  bad_link: "Ссылка устарела. Откройте список и нажмите «Напомнить в Telegram» ещё раз.",
};

export function attachResultText(result: AttachResult | "bad_link"): string {
  return ATTACH_TEXTS[result];
}

function missingHint(card: BotItemCard): string | null {
  if (card.parseStatus !== "partial" && card.parseStatus !== "failed") return null;
  const missing = [card.title === "" ? "название" : null, card.priceKopecks === null ? "цену" : null].filter((field) => field !== null);
  if (missing.length === 0) return null;
  const pronoun = missing.length === 1 && missing[0] === "цену" ? "её" : missing.length === 1 ? "его" : "их";
  return `Магазин не отдал ${missing.join(" и ")} — впишите ${pronoun} в приложении («Изменить»)`;
}

export function itemCardText(card: BotItemCard): string {
  const loading = card.parseStatus === "pending" && card.title === "";
  const lines = [loading ? "<i>Загружаем данные из магазина…</i>" : `<b>${escapeHtml(card.title || "Подарок без названия")}</b>`];
  const store = card.sourceUrl ? detectStore(card.sourceUrl).label : null;
  const meta = [card.priceKopecks !== null ? formatKopecks(card.priceKopecks) : null, store].filter((part) => part !== null).join(" · ");
  if (meta) lines.push(escapeHtml(meta));
  lines.push(`В списке «${escapeHtml(card.wishlistTitle)}»`);
  const hint = missingHint(card);
  if (hint) lines.push("", hint);
  return lines.join("\n");
}

export function itemDeletedByOwnerText(card: Pick<BotItemCard, "title" | "wishlistTitle">): string {
  return `Удалил «${escapeHtml(card.title || "подарок")}» из списка «${escapeHtml(card.wishlistTitle)}».`;
}

export function ownerReservedText(notice: ReservationNotice): string {
  return `🎁 Кто-то забронировал «${escapeHtml(notice.itemTitle)}» из списка «${escapeHtml(notice.wishlistTitle)}». Кто — не скажем: пусть будет сюрприз.`;
}

export function guestReservedText(notice: ReservationNotice, now: Date): string {
  const head = `Готово! Вы дарите «${escapeHtml(notice.itemTitle)}» для ${escapeHtml(notice.ownerName)}.`;
  const days = daysUntil(notice.eventDate, now);
  if (days === null) return head;
  return `${head}\n${countdownLabel(notice.occasion, days)}. ${REMINDER_PROMISE}`;
}

export function itemDeletedText(notice: ReservationNotice): string {
  return `${escapeHtml(notice.ownerName)} удалил(а) «${escapeHtml(notice.itemTitle)}» из списка «${escapeHtml(notice.wishlistTitle)}» — бронь больше не нужна. Можно выбрать другой подарок.`;
}

export function reminderText(reminders: readonly DueReminder[]): string {
  const lines = reminders.map(
    (r) => `• ${countdownLabel(r.occasion, r.daysLeft)} у ${escapeHtml(r.ownerName)} — вы дарите «${escapeHtml(r.itemTitle)}»`,
  );
  return ["Напоминание о подарках 🎁", ...lines].join("\n");
}
```

- [x] **Step 5: Тест проходит**

Run: `pnpm vitest run apps/worker/src/bot`
Expected: PASS. Цена в ожидании — с неразрывным пробелом ` ` (так форматирует `formatKopecks`); если тест падает на пробеле, проверить именно это, а не менять форматирование.

Проверка текста частичной карточки: `itemCardText({...card, priceKopecks: null, parseStatus: "partial"})` содержит «Магазин не отдал цену — впишите её в приложении («Изменить»)» — ожидание в тесте проверяет подстроку без скобок.

- [x] **Step 6: Проверка и commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add apps/worker/src/bot
git commit -m "feat(worker): bot message texts and link extraction"
```

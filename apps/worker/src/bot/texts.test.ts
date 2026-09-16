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
    expect(itemCardText(card)).toBe("<b>Наушники &amp; чехол</b>\n1 472 ₽ · Wildberries\nВ списке «ДР &lt;30&gt;»");
  });

  test("pending card says data is loading", () => {
    expect(itemCardText({ ...card, title: "", priceKopecks: null, parseStatus: "pending" })).toBe(
      "<i>Загружаем данные из магазина…</i>\nWildberries\nВ списке «ДР &lt;30&gt;»",
    );
  });

  test("partial and failed cards ask only for what is missing", () => {
    expect(itemCardText({ ...card, priceKopecks: null, parseStatus: "partial" })).toContain("Магазин не отдал цену — впишите её в приложении");
    expect(itemCardText({ ...card, title: "", priceKopecks: null, parseStatus: "failed" })).toContain("<b>Подарок без названия</b>");
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

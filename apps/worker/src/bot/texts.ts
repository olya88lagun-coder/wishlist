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
  const pronoun = missing.length > 1 ? "их" : missing[0] === "цену" ? "её" : "его";
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

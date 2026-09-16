import type { NotifyJob } from "@wishlist/core";
import {
  type BotItemCard,
  cancelReservationForUser,
  type Database,
  deleteItem,
  getBotItemCard,
  listWishlistsForOwner,
  moveItem,
} from "@wishlist/db";
import type { InlineKeyboardMarkup } from "grammy/types";
import type { SendExtra } from "../telegram/messenger";
import { type CardDeps, renderItemCard } from "./card";
import { CALLBACK, itemCardKeyboard, listChoiceKeyboard } from "./keyboards";
import { itemDeletedByOwnerText, limitReachedText, RESERVATION_CANCELLED_TEXT } from "./texts";

export type CallbackOutcome =
  | { kind: "edit"; text: string; extra: SendExtra }
  | { kind: "markup"; markup: InlineKeyboardMarkup }
  | { kind: "toast"; text: string };

export type CallbackDeps = CardDeps & { db: Database; enqueueNotify(job: NotifyJob): Promise<void> };

const GONE: CallbackOutcome = { kind: "toast", text: "Этот подарок уже недоступен" };
const STALE: CallbackOutcome = { kind: "toast", text: "Кнопка устарела" };
const NO_BUTTONS: SendExtra = { reply_markup: { inline_keyboard: [] } };
const CALLBACK_PATTERN = /^(mv|to|bk|del|cx):([0-9a-f-]{36})(?::(\d{1,2}))?$/;

async function ownedCard(deps: CallbackDeps, userId: string, itemId: string): Promise<BotItemCard | null> {
  const card = await getBotItemCard(deps.db, itemId);
  return card && !card.deleted && card.ownerId === userId ? card : null;
}

async function moveTo(deps: CallbackDeps, userId: string, card: BotItemCard, index: number): Promise<CallbackOutcome> {
  const target = (await listWishlistsForOwner(deps.db, userId))[index];
  if (!target) return { kind: "toast", text: "Список не найден — откройте выбор ещё раз" };
  const moved = await moveItem(deps.db, userId, card.id, target.id);
  if (moved === "limit_reached") return { kind: "toast", text: limitReachedText(target.title) };
  const updated = await getBotItemCard(deps.db, card.id);
  if (moved !== "moved" || !updated) return GONE;
  const message = renderItemCard(updated, deps);
  return { kind: "edit", text: message.text, extra: message.extra };
}

export async function handleCallback(deps: CallbackDeps, userId: string, data: string): Promise<CallbackOutcome> {
  const match = CALLBACK_PATTERN.exec(data);
  if (!match) return STALE;
  const action = match[1]!;
  const id = match[2]!;
  const index = match[3];

  if (action === "cx") {
    if (!(await cancelReservationForUser(deps.db, id, userId))) return { kind: "toast", text: "Бронь уже снята" };
    return { kind: "edit", text: RESERVATION_CANCELLED_TEXT, extra: NO_BUTTONS };
  }

  const card = await ownedCard(deps, userId, id);
  if (!card) return GONE;

  switch (action) {
    case CALLBACK.move:
      return { kind: "markup", markup: listChoiceKeyboard(card.id, await listWishlistsForOwner(deps.db, userId)) };
    case CALLBACK.back:
      return { kind: "markup", markup: itemCardKeyboard(card, deps.appUrl) };
    case CALLBACK.moveTo:
      return index === undefined ? STALE : moveTo(deps, userId, card, Number(index));
    case CALLBACK.remove:
      if (!(await deleteItem(deps.db, userId, card.id))) return GONE;
      await deps.enqueueNotify({ kind: "item_deleted", itemId: card.id });
      return { kind: "edit", text: itemDeletedByOwnerText(card), extra: NO_BUTTONS };
    default:
      return STALE;
  }
}

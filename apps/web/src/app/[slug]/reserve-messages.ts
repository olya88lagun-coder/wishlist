import type { CancelResult, ReserveResult } from "@wishlist/db";

type ReserveFailure = Exclude<ReserveResult, { ok: true }>["reason"];
type CancelFailure = Exclude<CancelResult, { ok: true }>["reason"];

const NOT_FOUND = "Подарок не найден — возможно, его удалили";

const RESERVE_MESSAGES: Record<ReserveFailure, string> = {
  ALREADY_RESERVED: "Упс, этот подарок уже забронировали",
  OWNER_CANNOT_RESERVE: "Это ваш список — бронировать в нём нельзя",
  INVALID_NAME: "Напишите имя — до 40 символов",
  NOT_FOUND,
  NO_IDENTITY: "Не получилось. Обновите страницу и попробуйте ещё раз",
};

const CANCEL_MESSAGES: Record<CancelFailure, string> = {
  NOT_YOUR_RESERVATION: "Эту бронь поставил другой человек",
  NOT_RESERVED: "Бронь уже снята",
  NOT_FOUND,
};

export function reserveErrorMessage(reason: ReserveFailure): string {
  return RESERVE_MESSAGES[reason];
}

export function cancelErrorMessage(reason: CancelFailure): string {
  return CANCEL_MESSAGES[reason];
}

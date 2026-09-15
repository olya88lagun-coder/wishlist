import { expect, test } from "vitest";
import { cancelErrorMessage, reserveErrorMessage } from "./reserve-messages";

test("every reservation failure has a human message", () => {
  expect(reserveErrorMessage("ALREADY_RESERVED")).toBe("Упс, этот подарок уже забронировали");
  expect(reserveErrorMessage("OWNER_CANNOT_RESERVE")).toBe("Это ваш список — бронировать в нём нельзя");
  expect(reserveErrorMessage("INVALID_NAME")).toBe("Напишите имя — до 40 символов");
  expect(reserveErrorMessage("NOT_FOUND")).toBe("Подарок не найден — возможно, его удалили");
  expect(reserveErrorMessage("NO_IDENTITY")).toBe("Не получилось. Обновите страницу и попробуйте ещё раз");
  expect(cancelErrorMessage("NOT_YOUR_RESERVATION")).toBe("Эту бронь поставил другой человек");
  expect(cancelErrorMessage("NOT_RESERVED")).toBe("Бронь уже снята");
  expect(cancelErrorMessage("NOT_FOUND")).toBe("Подарок не найден — возможно, его удалили");
});

"use server";

import { cancelReservation, reserveItem } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { enqueueNotify } from "@/server/queue";
import { reservationLimiter } from "@/server/rate-limit";
import { clientKey, ensureGuestViewer, readViewer } from "@/server/viewer";
import { errorState, type FormState, formValues, initialFormState, LIMIT_MESSAGES, successState } from "../lists/form-state";
import { cancelErrorMessage, reserveErrorMessage } from "./reserve-messages";

export async function reserveAction(slug: string, itemId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { viewer } = await ensureGuestViewer();
  if (!reservationLimiter.allow(await clientKey(viewer))) return errorState({}, LIMIT_MESSAGES.rate, formValues(form));
  const guestName = typeof form.get("guestName") === "string" ? String(form.get("guestName")) : "";
  const result = await reserveItem(getDb(), { slug, itemId, viewer, guestName });
  revalidatePath(`/${slug}`);
  if (!result.ok) {
    const message = reserveErrorMessage(result.reason);
    return result.reason === "INVALID_NAME" ? errorState({ guestName: message }, null, formValues(form)) : errorState({}, message, formValues(form));
  }
  await enqueueNotify({ kind: "reservation_created", itemId });
  return successState("Готово! Подарок за вами");
}

export async function cancelAction(slug: string, itemId: string, _prev: FormState, _form: FormData): Promise<FormState> {
  try {
    const { viewer } = await readViewer();
    if (!reservationLimiter.allow(await clientKey(viewer))) return errorState({}, `Бронь не снята. ${LIMIT_MESSAGES.rate}`);
    if (!viewer.userId && !viewer.guestToken) return errorState({}, cancelErrorMessage("NOT_YOUR_RESERVATION"));
    const result = await cancelReservation(getDb(), { slug, itemId, viewer });
    revalidatePath(`/${slug}`);
    if (!result.ok) {
      const message = cancelErrorMessage(result.reason);
      return result.reason === "NOT_RESERVED" ? successState(message) : errorState({}, message);
    }
    return successState("Ваша бронь снята.");
  } catch {
    console.error("cancel reservation failed");
    return errorState({}, "Не удалось подтвердить отмену. Обновите страницу и попробуйте ещё раз.");
  }
}

// Нативная отправка формы использует ту же проверку прав, но не возвращает React form state.
export async function cancelFormAction(slug: string, itemId: string, form: FormData): Promise<void> {
  await cancelAction(slug, itemId, initialFormState, form);
}

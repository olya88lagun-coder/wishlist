"use server";

import { cancelReservation, reserveItem } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { reservationLimiter } from "@/server/rate-limit";
import { clientKey, ensureGuestViewer } from "@/server/viewer";
import { errorState, type FormState, formValues, LIMIT_MESSAGES, successState } from "../lists/form-state";
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
  return successState("Готово! Подарок за вами");
}

export async function cancelAction(slug: string, itemId: string): Promise<void> {
  const { viewer } = await ensureGuestViewer();
  if (!reservationLimiter.allow(await clientKey(viewer))) return;
  const result = await cancelReservation(getDb(), { slug, itemId, viewer });
  if (!result.ok) console.warn("cancel reservation failed", cancelErrorMessage(result.reason));
  revalidatePath(`/${slug}`);
}

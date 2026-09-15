"use server";

import { addItem, deleteItem, deleteWishlist, updateItem, updateWishlist } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { parseItemForm, parseWishlistForm } from "@/server/forms";
import { enqueueParse } from "@/server/queue";
import { editLimiter } from "@/server/rate-limit";
import { clientKey, requireUser } from "@/server/viewer";
import { errorState, type FormState, formValues, LIMIT_MESSAGES, successState } from "../form-state";

async function authorizedOwner() {
  const user = await requireUser();
  const allowed = editLimiter.allow(await clientKey({ userId: user.id, guestToken: null }));
  return { user, allowed };
}

export async function updateListAction(wishlistId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, allowed } = await authorizedOwner();
  if (!allowed) return errorState({}, LIMIT_MESSAGES.rate, formValues(form));
  const parsed = parseWishlistForm(form);
  if (!parsed.ok) return errorState(parsed.errors, null, formValues(form));
  if (!(await updateWishlist(getDb(), user.id, wishlistId, parsed.value))) return errorState({}, LIMIT_MESSAGES.notFound, formValues(form));
  revalidatePath(`/lists/${wishlistId}`);
  return successState("Сохранено");
}

export async function deleteListAction(wishlistId: string): Promise<void> {
  const { user } = await authorizedOwner();
  await deleteWishlist(getDb(), user.id, wishlistId);
  revalidatePath("/lists");
  redirect("/lists");
}

export async function addItemAction(wishlistId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, allowed } = await authorizedOwner();
  if (!allowed) return errorState({}, LIMIT_MESSAGES.rate, formValues(form));
  const parsed = parseItemForm(form);
  if (!parsed.ok) return errorState(parsed.errors, null, formValues(form));
  const result = await addItem(getDb(), user.id, wishlistId, parsed.value);
  if (!result.ok) return errorState({}, result.reason === "LIMIT_REACHED" ? LIMIT_MESSAGES.items : LIMIT_MESSAGES.notFound, formValues(form));
  if (result.needsParsing) await enqueueParse(result.itemId);
  revalidatePath(`/lists/${wishlistId}`);
  return successState(result.needsParsing ? "Подарок добавлен — подтягиваем данные из магазина" : "Подарок добавлен");
}

export async function updateItemAction(wishlistId: string, itemId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, allowed } = await authorizedOwner();
  if (!allowed) return errorState({}, LIMIT_MESSAGES.rate, formValues(form));
  const parsed = parseItemForm(form);
  if (!parsed.ok) return errorState(parsed.errors, null, formValues(form));
  const result = await updateItem(getDb(), user.id, itemId, parsed.value);
  if (!result.ok) return errorState({}, LIMIT_MESSAGES.notFound, formValues(form));
  if (result.needsParsing) await enqueueParse(itemId);
  revalidatePath(`/lists/${wishlistId}`);
  return successState("Сохранено");
}

export async function deleteItemAction(wishlistId: string, itemId: string): Promise<void> {
  const { user } = await authorizedOwner();
  await deleteItem(getDb(), user.id, itemId);
  revalidatePath(`/lists/${wishlistId}`);
}

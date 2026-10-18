"use server";

import { createWishlist } from "@wishlist/db";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { parseWishlistForm } from "@/server/forms";
import { editLimiter } from "@/server/rate-limit";
import { clientKey, requireUser } from "@/server/viewer";
import { errorState, type FormState, formValues, LIMIT_MESSAGES } from "./form-state";
import { giftReturnPath } from "@/lib/gift-return-path";
import { recordCompletion } from "@/server/analytics-completion";

export async function createListAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!editLimiter.allow(await clientKey({ userId: user.id, guestToken: null }))) return errorState({}, LIMIT_MESSAGES.rate, formValues(form));
  const parsed = parseWishlistForm(form);
  if (!parsed.ok) return errorState(parsed.errors, null, formValues(form));
  const created = await createWishlist(getDb(), user.id, parsed.value);
  if (!created.ok) return errorState({}, LIMIT_MESSAGES.wishlists, formValues(form));
  await recordCompletion({ event: "wishlist_created", params: { source: giftReturnPath(form.get("returnTo")) ? "finder" : "direct" } });
  redirect(giftReturnPath(form.get("returnTo")) ?? `/lists/${created.wishlist.id}`);
}

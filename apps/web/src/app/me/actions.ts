"use server";

import { setSurpriseMode } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/viewer";
import { type FormState, successState } from "../lists/form-state";

export async function saveSurpriseModeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const enabled = form.get("surpriseMode") === "on";
  await setSurpriseMode(getDb(), user.id, enabled);
  revalidatePath("/me");
  revalidatePath("/lists", "layout");
  return successState(enabled ? "Полный сюрприз включён" : "Полный сюрприз выключен");
}

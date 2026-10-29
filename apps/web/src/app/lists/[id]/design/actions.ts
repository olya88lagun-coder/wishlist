"use server";

import { getOwnedWishlist, getPendingDesignOrders, setWishlistTheme } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/server/db";
import { createDesignCheckout, refreshDesignPayment } from "@/server/design-payments";
import { editLimiter } from "@/server/rate-limit";
import { requireUser } from "@/server/viewer";

export type DesignState = { message: string };

export async function checkoutDesignAction(wishlistId: string, _state: DesignState, form: FormData): Promise<DesignState> {
  const user = await requireUser();
  if (!editLimiter.allow(`design:${user.id}`)) return { message: "Слишком много запросов. Попробуйте через минуту." };
  const parsed = z.object({ product: z.enum(["children", "children_invitation", "new_year", "celebration"]), email: z.email().max(254), consent: z.literal("on") })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Укажите email и подтвердите условия покупки." };
  let url: string | null;
  try { url = await createDesignCheckout(user.id, wishlistId, parsed.data.product, parsed.data.email); }
  catch { return { message: "Не удалось начать оплату. Повторите попытку: новый платёж не будет создан вместо уже начатого." }; }
  if (!url) return { message: "Пакет уже куплен либо другой платёж ещё не завершён. Проверьте оплату." };
  redirect(url);
}

export async function selectThemeAction(wishlistId: string, _state: DesignState, form: FormData): Promise<DesignState> {
  const user = await requireUser();
  if (!editLimiter.allow(`design:${user.id}`)) return { message: "Попробуйте через минуту." };
  const theme = z.enum(["journal", "children", "children-pink", "new-year", "celebration"]).safeParse(form.get("theme"));
  if (!theme.success || !(await setWishlistTheme(getDb(), user.id, wishlistId, theme.data))) return { message: "Оформление недоступно." };
  const list = await getOwnedWishlist(getDb(), user.id, wishlistId);
  revalidatePath(`/lists/${wishlistId}/design`);
  if (list) revalidatePath(`/${list.slug}`);
  return { message: "Оформление сохранено" };
}

export async function checkDesignPaymentAction(wishlistId: string): Promise<void> {
  const user = await requireUser();
  if (!editLimiter.allow(`payment-check:${user.id}`)) return;
  const list = await getOwnedWishlist(getDb(), user.id, wishlistId);
  if (!list) return;
  for (const order of await getPendingDesignOrders(getDb(), user.id, wishlistId)) {
    if (order.paymentId) {
      try { await refreshDesignPayment(order.paymentId); } catch { /* Provider failure leaves the order pending for a safe retry. */ }
    }
  }
  revalidatePath(`/lists/${wishlistId}/design`);
  revalidatePath(`/${list.slug}`);
}

"use server";

import { addItem } from "@wishlist/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/server/db";
import { enqueueParse } from "@/server/queue";
import { editLimiter } from "@/server/rate-limit";
import { clientKey, requireUser } from "@/server/viewer";

const schema = z.object({
  wishlistId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  productUrl: z.string().url().max(2000).nullable(),
  note: z.string().trim().max(500).nullable(),
});

export async function addGiftToWishlist(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Некорректные данные" };

  const user = await requireUser();
  if (!editLimiter.allow(await clientKey({ userId: user.id, guestToken: null }))) {
    return { ok: false as const, message: "Слишком много действий. Попробуйте чуть позже." };
  }

  const result = await addItem(getDb(), user.id, parsed.data.wishlistId, {
    title: parsed.data.title,
    sourceUrl: parsed.data.productUrl,
    priceKopecks: null,
    note: parsed.data.note,
    isMustHave: false,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      message: result.reason === "LIMIT_REACHED"
        ? "В этом вишлисте достигнут лимит подарков."
        : "Вишлист не найден.",
    };
  }

  if (result.needsParsing) await enqueueParse(result.itemId);
  revalidatePath("/lists");
  revalidatePath(`/lists/${parsed.data.wishlistId}`);

  return { ok: true as const, itemId: result.itemId };
}

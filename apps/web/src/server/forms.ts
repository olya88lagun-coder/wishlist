import { normalizeProductUrl, parseRublesToKopecks } from "@wishlist/core";
import { ITEM_NOTE_MAX, ITEM_TITLE_MAX, type ItemInput, WISHLIST_TITLE_MAX, type WishlistInput } from "@wishlist/db";
import { z } from "zod";

export type FieldErrors = Record<string, string>;
export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const titleSchema = (max: number, emptyMessage: string, noun: string) =>
  z.string().min(1, emptyMessage).max(max, `${noun} длиннее ${max} символов`);

const wishlistSchema = z.object({
  title: titleSchema(WISHLIST_TITLE_MAX, "Введите название списка", "Название"),
  occasion: z.enum(["birthday", "new_year", "other"], { error: "Выберите повод" }),
  eventDate: z
    .string()
    .refine((v) => v === "" || isRealDate(v), "Проверьте дату")
    .transform((v) => (v === "" ? null : v)),
});

function collectErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    errors[field] ??= issue.message;
  }
  return errors;
}

export function parseWishlistForm(form: FormData): FormResult<WishlistInput> {
  const parsed = wishlistSchema.safeParse({ title: text(form, "title"), occasion: text(form, "occasion"), eventDate: text(form, "eventDate") });
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: collectErrors(parsed.error) };
}

export function parseItemForm(form: FormData): FormResult<ItemInput> {
  const errors: FieldErrors = {};
  const title = titleSchema(ITEM_TITLE_MAX, "Введите название подарка", "Название").safeParse(text(form, "title"));
  if (!title.success) errors.title = title.error.issues[0]!.message;

  const rawUrl = text(form, "url");
  const sourceUrl = rawUrl === "" ? null : normalizeProductUrl(rawUrl);
  if (rawUrl !== "" && sourceUrl === null) errors.url = "Ссылка должна начинаться с https://";

  const rawPrice = text(form, "price");
  const priceKopecks = rawPrice === "" ? null : parseRublesToKopecks(rawPrice);
  if (rawPrice !== "" && priceKopecks === null) errors.price = "Цена — число в рублях, например 2 490";

  const note = text(form, "note");
  if (note.length > ITEM_NOTE_MAX) errors.note = `Заметка длиннее ${ITEM_NOTE_MAX} символов`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { title: title.data!, sourceUrl, priceKopecks, note: note === "" ? null : note, isMustHave: form.get("isMustHave") === "on" },
  };
}

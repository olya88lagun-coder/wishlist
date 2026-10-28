import { z } from "zod";

const singleLine = (max: number) => z.string().trim().max(max, `Не больше ${max} символов`);
const isSingleLine = (value: string) => !/[\r\n\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value);

export const invitationSchema = z.strictObject({
  color: z.enum(["blue", "pink"]).default("blue"),
  name: singleLine(40).min(1, "Укажите имя ребёнка").refine(isSingleLine, "Введите текст в одну строку"),
  age: z.string().trim().regex(/^(?:|[1-9][0-9]?)$/, "Возраст от 1 до 99").optional(),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !value.startsWith("0000") && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, "Укажите существующую дату"),
  time: z.string().trim().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Укажите время"),
  place: singleLine(120).refine(isSingleLine, "Введите текст в одну строку").optional(),
  message: z.string().trim().max(180, "Не больше 180 символов")
    .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value), "Уберите служебные символы").optional(),
});

export type InvitationInput = z.infer<typeof invitationSchema>;

// Keep preview and PNG identical without next/og fetching missing fonts or emoji.
export function invitationDisplayText(text: string): string {
  return text.replace(/\s+/gu, " ").replace(/[^\u0020-\u007e\u00a0-\u024f\u0400-\u052f\u2010-\u2027\u2030-\u203a\u20ac\u2116]/gu, "?");
}

export function formatInvitationDate(date: string): string {
  if (!invitationSchema.shape.date.safeParse(date).success) return "Дата праздника";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00.000Z`));
}

export function invitationAge(age?: string): string {
  if (!age) return "";
  const n = Number(age);
  const suffix = n % 100 >= 11 && n % 100 <= 14 ? "лет" : n % 10 === 1 ? "год" : n % 10 >= 2 && n % 10 <= 4 ? "года" : "лет";
  return `${age} ${suffix}`;
}

export function invitationMessage(input: InvitationInput, shareUrl: string): string {
  return ["Приглашаем на день рождения!", `${input.name}${input.age ? ` · ${invitationAge(input.age)}` : ""}`,
    `${formatInvitationDate(input.date)}, ${input.time}`, input.place, input.message, `Список подарков: ${shareUrl}`]
    .filter(Boolean).join("\n");
}

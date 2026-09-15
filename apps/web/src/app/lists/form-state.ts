import type { FieldErrors } from "@/server/forms";

export type FormValues = Record<string, string>;

// values — отправленные поля: React 19 сбрасывает форму после action, поля восстанавливаются из них
export type FormState = { status: "idle" | "error" | "success"; errors: FieldErrors; message: string | null; values: FormValues };

export const initialFormState: FormState = { status: "idle", errors: {}, message: null, values: {} };

export function errorState(errors: FieldErrors, message: string | null = null, values: FormValues = {}): FormState {
  return { status: "error", errors, message, values };
}

export function successState(message: string | null = null): FormState {
  return { status: "success", errors: {}, message, values: {} };
}

export function formValues(form: FormData): FormValues {
  const values: FormValues = {};
  for (const [name, value] of form.entries()) {
    if (typeof value === "string" && !name.startsWith("$ACTION")) values[name] = value;
  }
  return values;
}

export const LIMIT_MESSAGES = {
  wishlists: "Достигнут лимит списков. Удалите ненужный, чтобы создать новый.",
  items: "В списке уже максимум подарков.",
  rate: "Слишком много действий подряд. Подождите минуту.",
  notFound: "Список не найден или был удалён.",
} as const;

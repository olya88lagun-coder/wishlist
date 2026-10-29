"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { useFormErrorFocus } from "@/components/use-form-error-focus";
import type { WishlistSummary } from "@wishlist/db";
import { initialFormState } from "../form-state";
import { deleteListAction, updateListAction } from "./actions";
import { ConfirmButton } from "./ConfirmButton";

export function ListSettings({ wishlist }: { wishlist: Pick<WishlistSummary, "id" | "title" | "occasion" | "audience" | "eventDate"> }) {
  const [state, action] = useActionState(updateListAction.bind(null, wishlist.id), initialFormState);
  const formRef = useFormErrorFocus(state);
  const values = state.status === "error" ? state.values : { title: wishlist.title, occasion: wishlist.occasion, audience: wishlist.audience ?? "", eventDate: wishlist.eventDate ?? "" };
  return (
    <details className="panel owner-settings-card">
      <summary>Настройки списка <span aria-hidden="true">→</span></summary>
      <form ref={formRef} action={action} className="stack owner-settings-card__form" noValidate>
        <div className="field">
          <label htmlFor="list-title">Название</label>
          <input id="list-title" name="title" className="input" maxLength={80} defaultValue={values.title ?? ""} aria-invalid={state.errors.title ? true : undefined} aria-describedby={state.errors.title ? "list-title-error" : undefined} />
          {state.errors.title && <p id="list-title-error" className="error">{state.errors.title}</p>}
        </div>
        <div className="field">
          <label htmlFor="list-occasion">Повод</label>
          <select key={values.occasion ?? "birthday"} id="list-occasion" name="occasion" className="select" defaultValue={values.occasion ?? "birthday"} aria-invalid={state.errors.occasion ? true : undefined} aria-describedby={state.errors.occasion ? "list-occasion-error" : undefined}>
            <option value="birthday">День рождения</option>
            <option value="new_year">Новый год</option>
            <option value="other">Другой праздник</option>
          </select>
          {state.errors.occasion && <p id="list-occasion-error" className="error">{state.errors.occasion}</p>}
        </div>
        <div className="field">
          <label htmlFor="list-audience">Для кого список</label>
          <select key={values.audience ?? ""} id="list-audience" name="audience" className="select" defaultValue={values.audience ?? ""} aria-invalid={state.errors.audience ? true : undefined} aria-describedby={state.errors.audience ? "list-audience-error" : undefined}>
            <option value="">Не указывать</option>
            <option value="adult">Для взрослого</option>
            <option value="child">Для ребёнка</option>
          </select>
          {state.errors.audience && <p id="list-audience-error" className="error">{state.errors.audience}</p>}
        </div>
        <div className="field">
          <label htmlFor="list-date">Дата праздника</label>
          <input id="list-date" name="eventDate" type="date" className="input" defaultValue={values.eventDate ?? ""} aria-invalid={state.errors.eventDate ? true : undefined} aria-describedby={state.errors.eventDate ? "list-date-error" : undefined} />
          {state.errors.eventDate && <p id="list-date-error" className="error">{state.errors.eventDate}</p>}
        </div>
        {state.message && <p className={state.status === "error" ? "error" : "muted"} role="status" tabIndex={-1} data-form-error>{state.message}</p>}
        <SubmitButton pendingText="Сохраняем…" variant="ghost">Сохранить</SubmitButton>
      </form>
      <div className="owner-settings-card__danger">
        <ConfirmButton action={deleteListAction.bind(null, wishlist.id)} question="Удалить список со всеми подарками и бронями? Это нельзя отменить.">
          Удалить список
        </ConfirmButton>
      </div>
    </details>
  );
}

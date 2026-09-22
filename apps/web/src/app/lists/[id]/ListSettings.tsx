"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { WishlistSummary } from "@wishlist/db";
import { initialFormState } from "../form-state";
import { deleteListAction, updateListAction } from "./actions";
import { ConfirmButton } from "./ConfirmButton";

export function ListSettings({ wishlist }: { wishlist: Pick<WishlistSummary, "id" | "title" | "occasion" | "eventDate"> }) {
  const [state, action] = useActionState(updateListAction.bind(null, wishlist.id), initialFormState);
  const values = state.status === "error" ? state.values : { title: wishlist.title, occasion: wishlist.occasion, eventDate: wishlist.eventDate ?? "" };
  return (
    <details className="panel owner-settings-card">
      <summary>Настройки списка <span aria-hidden="true">→</span></summary>
      <form action={action} className="stack owner-settings-card__form" noValidate>
        <div className="field">
          <label htmlFor="list-title">Название</label>
          <input id="list-title" name="title" className="input" maxLength={80} defaultValue={values.title ?? ""} />
          {state.errors.title && <p className="error">{state.errors.title}</p>}
        </div>
        <div className="field">
          <label htmlFor="list-occasion">Повод</label>
          <select id="list-occasion" name="occasion" className="select" defaultValue={values.occasion ?? "birthday"}>
            <option value="birthday">День рождения</option>
            <option value="new_year">Новый год</option>
            <option value="other">Другой праздник</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="list-date">Дата праздника</label>
          <input id="list-date" name="eventDate" type="date" className="input" defaultValue={values.eventDate ?? ""} />
          {state.errors.eventDate && <p className="error">{state.errors.eventDate}</p>}
        </div>
        {state.message && <p className={state.status === "error" ? "error" : "muted"} role="status">{state.message}</p>}
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

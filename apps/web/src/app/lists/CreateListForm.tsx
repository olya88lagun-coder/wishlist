"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { createListAction } from "./actions";
import { initialFormState } from "./form-state";

export function CreateListForm({ defaultOpen }: { defaultOpen: boolean }) {
  const [state, action] = useActionState(createListAction, initialFormState);
  return (
    <details className="panel owner-create-card" open={defaultOpen || state.status === "error"}>
      <summary className="owner-create-card__summary">
        <span className="owner-create-card__icon" aria-hidden="true">＋</span>
        <span>
          <strong>Новый список</strong>
          <small>Соберите желания для следующего праздника</small>
        </span>
        <span className="owner-create-card__arrow" aria-hidden="true">→</span>
      </summary>
      <form action={action} className="stack owner-create-card__form" noValidate>
        <div className="field">
          <label htmlFor="title">Название</label>
          <input id="title" name="title" className="input" placeholder="Маше тридцать" maxLength={80} defaultValue={state.values.title ?? ""} required />
          {state.errors.title && <p className="error">{state.errors.title}</p>}
        </div>
        <div className="field">
          <label htmlFor="occasion">Повод</label>
          <select id="occasion" name="occasion" className="select" defaultValue={state.values.occasion ?? "birthday"}>
            <option value="birthday">День рождения</option>
            <option value="new_year">Новый год</option>
            <option value="other">Другой праздник</option>
          </select>
          {state.errors.occasion && <p className="error">{state.errors.occasion}</p>}
        </div>
        <div className="field">
          <label htmlFor="eventDate">Дата праздника</label>
          <input id="eventDate" name="eventDate" type="date" className="input" defaultValue={state.values.eventDate ?? ""} />
          {state.errors.eventDate && <p className="error">{state.errors.eventDate}</p>}
        </div>
        {state.message && <p className="error">{state.message}</p>}
        <SubmitButton pendingText="Создаём…">Создать список</SubmitButton>
      </form>
    </details>
  );
}

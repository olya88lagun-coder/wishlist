"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { useFormErrorFocus } from "@/components/use-form-error-focus";
import { createListAction } from "./actions";
import { initialFormState } from "./form-state";

export function CreateListForm({ defaultOpen, returnTo }: { defaultOpen: boolean; returnTo?: string | null }) {
  const [state, action] = useActionState(createListAction, initialFormState);
  const formRef = useFormErrorFocus(state);
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
      <form ref={formRef} action={action} className="stack owner-create-card__form" noValidate>
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <div className="field">
          <label htmlFor="title">Название</label>
          <input id="title" name="title" className="input" placeholder="Маше тридцать" maxLength={80} defaultValue={state.values.title ?? ""} aria-invalid={state.errors.title ? true : undefined} aria-describedby={state.errors.title ? "create-title-error" : undefined} required />
          {state.errors.title && <p id="create-title-error" className="error">{state.errors.title}</p>}
        </div>
        <div className="field">
          <label htmlFor="occasion">Повод</label>
          <select key={state.values.occasion ?? "birthday"} id="occasion" name="occasion" className="select" defaultValue={state.values.occasion ?? "birthday"} aria-invalid={state.errors.occasion ? true : undefined} aria-describedby={state.errors.occasion ? "create-occasion-error" : undefined}>
            <option value="birthday">День рождения</option>
            <option value="new_year">Новый год</option>
            <option value="other">Другой праздник</option>
          </select>
          {state.errors.occasion && <p id="create-occasion-error" className="error">{state.errors.occasion}</p>}
        </div>
        <div className="field">
          <label htmlFor="eventDate">Дата праздника</label>
          <input id="eventDate" name="eventDate" type="date" className="input" defaultValue={state.values.eventDate ?? ""} aria-invalid={state.errors.eventDate ? true : undefined} aria-describedby={state.errors.eventDate ? "create-date-error" : undefined} />
          {state.errors.eventDate && <p id="create-date-error" className="error">{state.errors.eventDate}</p>}
        </div>
        {state.message && <p className="error" role="status" tabIndex={-1} data-form-error>{state.message}</p>}
        <SubmitButton pendingText="Создаём…">Создать список</SubmitButton>
      </form>
    </details>
  );
}

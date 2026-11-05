"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../../lists/form-state";
import { createSantaGameAction } from "../actions";

export function CreateSantaForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(createSantaGameAction, initialFormState);
  return (
    <form action={action} className="santa-form" noValidate>
      <div className="field">
        <label htmlFor="santa-title">Название игры</label>
        <input id="santa-title" name="title" className="input" maxLength={80} required placeholder="Например, Новый год с друзьями" defaultValue={state.values.title ?? ""} />
      </div>
      <div className="santa-form__pair">
        <div className="field">
          <label htmlFor="santa-budget">Бюджет</label>
          <input id="santa-budget" name="budget" className="input" maxLength={40} placeholder="до 1 500 ₽" defaultValue={state.values.budget ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="santa-date">Дата обмена</label>
          <input id="santa-date" name="exchangeDate" type="date" className="input" required defaultValue={state.values.exchangeDate ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="santa-name">Ваше имя в игре</label>
        <input id="santa-name" name="name" className="input" maxLength={40} required defaultValue={state.values.name ?? defaultName} />
      </div>
      {state.message && <p className="error" role="alert">{state.message}</p>}
      <SubmitButton pendingText="Создаём…">Создать игру</SubmitButton>
    </form>
  );
}

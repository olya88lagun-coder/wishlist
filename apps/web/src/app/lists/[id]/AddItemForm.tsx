"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../form-state";
import { addItemAction } from "./actions";
import { ItemFields, itemDefaultsFor } from "./ItemFields";

const EMPTY = { title: "", url: "", price: "", note: "", isMustHave: false };

export function AddItemForm({ wishlistId, defaultOpen }: { wishlistId: string; defaultOpen: boolean }) {
  const [state, action] = useActionState(addItemAction.bind(null, wishlistId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <details className="panel owner-manual-add" open={defaultOpen || state.status === "error"}>
      <summary>Добавить вручную или заполнить все поля <span aria-hidden="true">→</span></summary>
      <form ref={formRef} action={action} className="stack owner-manual-add__form" noValidate>
        <ItemFields idPrefix="new" defaults={itemDefaultsFor(state, EMPTY)} errors={state.errors} />
        {state.message && <p className={state.status === "error" ? "error" : "muted"} role="status">{state.message}</p>}
        <SubmitButton pendingText="Добавляем…">Добавить</SubmitButton>
      </form>
    </details>
  );
}

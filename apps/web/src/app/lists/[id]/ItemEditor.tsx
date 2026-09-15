"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../form-state";
import { updateItemAction } from "./actions";
import { type ItemDefaults, ItemFields, itemDefaultsFor } from "./ItemFields";

export function ItemEditor({ wishlistId, itemId, defaults }: { wishlistId: string; itemId: string; defaults: ItemDefaults }) {
  const [state, action] = useActionState(updateItemAction.bind(null, wishlistId, itemId), initialFormState);
  return (
    <details>
      <summary className="link-button">Изменить</summary>
      <form action={action} className="stack panel" style={{ marginTop: 8 }} noValidate>
        <ItemFields idPrefix={`edit-${itemId}`} defaults={itemDefaultsFor(state, defaults)} errors={state.errors} />
        {state.message && <p className={state.status === "error" ? "error" : "muted"} role="status">{state.message}</p>}
        <SubmitButton pendingText="Сохраняем…">Сохранить</SubmitButton>
      </form>
    </details>
  );
}

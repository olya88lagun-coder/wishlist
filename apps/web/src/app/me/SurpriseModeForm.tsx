"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../lists/form-state";
import { saveSurpriseModeAction } from "./actions";

export function SurpriseModeForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(saveSurpriseModeAction, initialFormState);
  return (
    <form action={action} className="panel stack">
      <label className="checkbox">
        <input type="checkbox" name="surpriseMode" defaultChecked={enabled} /> Полный сюрприз
      </label>
      <p className="muted" style={{ margin: 0 }}>
        Вы не увидите даже того, что подарок забронирован. Гости по-прежнему видят брони друг друга.
      </p>
      {state.message && <p className="muted" role="status" style={{ margin: 0 }}>{state.message}</p>}
      <SubmitButton pendingText="Сохраняем…" variant="ghost">Сохранить</SubmitButton>
    </form>
  );
}

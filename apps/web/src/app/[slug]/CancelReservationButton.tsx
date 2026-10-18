"use client";

import { useState, useTransition } from "react";
import { errorState, initialFormState } from "../lists/form-state";
import { cancelAction, cancelFormAction } from "./actions";

type Props = { slug: string; itemId: string; reserved: boolean };

export function CancelReservationButton({ slug, itemId, reserved }: Props) {
  const [state, setState] = useState(initialFormState);
  const [pending, startTransition] = useTransition();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const showMessage = !pending && Boolean(state.message) && !(reserved && state.status === "success");
  return (
    <>
      {reserved && !needsRefresh && (
        <form
          action={cancelFormAction.bind(null, slug, itemId)}
          onSubmit={(event) => {
            event.preventDefault();
            if (pending || !window.confirm("Снять бронь? Подарок снова станет свободным.")) return;
            startTransition(async () => {
              try { setState(await cancelAction(slug, itemId, initialFormState, new FormData())); }
              catch {
                // Потерянный ответ не доказывает ни успех, ни отказ: сначала сверяем бронь.
                setState(errorState({}, "Не удалось подтвердить отмену. Обновите страницу, чтобы проверить бронь."));
                setNeedsRefresh(true);
              }
            });
          }}
        >
          <button type="submit" className="link-button" disabled={pending} aria-busy={pending}>
            {pending ? "Отменяем…" : "Снять бронь"}
          </button>
        </form>
      )}
      <p className={showMessage ? (state.status === "error" ? "error" : "") : "visually-hidden"} role="status" aria-atomic="true" style={{ margin: 0, flexBasis: "100%" }}>
        {showMessage && state.message}
      </p>
      {needsRefresh && <button type="button" className="link-button" onClick={() => window.location.reload()}>Обновить страницу</button>}
    </>
  );
}

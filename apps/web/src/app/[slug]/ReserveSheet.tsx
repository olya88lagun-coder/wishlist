"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../lists/form-state";
import { reserveAction } from "./actions";

type Props = { slug: string; itemId: string; itemTitle: string; priceText: string | null; ownerName: string; defaultName: string };

export function ReserveSheet({ slug, itemId, itemTitle, priceText, ownerName, defaultName }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reserveAction.bind(null, slug, itemId), initialFormState);

  useEffect(() => {
    if (state.status === "success") setOpen(false);
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="button button--small" onClick={() => setOpen(true)}>Я подарю</button>
      {state.status === "error" && state.message && !open && <p className="error" role="status">{state.message}</p>}
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={`sheet-${itemId}`}>
            <div className="row row--between">
              <h2 id={`sheet-${itemId}`} className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>{itemTitle}</h2>
              <button type="button" className="link-button" onClick={() => setOpen(false)} aria-label="Закрыть">✕</button>
            </div>
            {priceText && <p className="serif" style={{ margin: "4px 0 12px" }}>{priceText}</p>}
            <form action={action} className="stack" noValidate>
              <div className="field">
                <label htmlFor={`guest-${itemId}`}>Как вас подписать</label>
                <input id={`guest-${itemId}`} name="guestName" className="input" maxLength={40} defaultValue={state.status === "error" ? (state.values.guestName ?? "") : defaultName} autoFocus required />
                {state.errors.guestName && <p className="error">{state.errors.guestName}</p>}
              </div>
              <p className="muted" style={{ margin: 0 }}>{ownerName} не узнает, кто дарит</p>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Нажимая «Я подарю», вы соглашаетесь на обработку указанного имени по{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">политике конфиденциальности</a>.
              </p>
              {state.status === "error" && state.message && <p className="error" role="status">{state.message}</p>}
              <SubmitButton pendingText="Бронируем…">Я подарю</SubmitButton>
            </form>
          </div>
        </>
      )}
    </>
  );
}

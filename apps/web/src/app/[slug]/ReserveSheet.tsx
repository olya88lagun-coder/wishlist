"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../lists/form-state";
import { reserveAction } from "./actions";
import { withActionAnalytics } from "@/lib/action-analytics";

type Props = { slug: string; itemId: string; itemTitle: string; priceText: string | null; ownerName: string; defaultName: string };

export function ReserveSheet({ slug, itemId, itemTitle, priceText, ownerName, defaultName }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [state, action] = useActionState(withActionAnalytics(reserveAction.bind(null, slug, itemId), "wishlist_reserved"), initialFormState);

  useEffect(() => {
    if (state.status === "success") setOpen(false);
    else if (state.status === "error" && state.errors.guestName) nameRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog) return;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const bottom = Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0));
      dialog.style.setProperty("--sheet-viewport-height", `${height}px`);
      dialog.style.setProperty("--sheet-viewport-bottom", `${bottom}px`);
    };
    updateViewport();
    dialog.showModal();
    nameRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      document.body.style.overflow = previousOverflow;
      // Revalidation can remove the sheet and clear its ref before this cleanup.
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className="button button--small reserve-sheet-trigger" onClick={() => setOpen(true)}>Я подарю</button>
      {state.status === "error" && state.message && !open && <p className="error" role="status">{state.message}</p>}
      {open && (
          <dialog
            ref={dialogRef}
            className="sheet"
            aria-labelledby={`sheet-${itemId}`}
            onCancel={(event) => { event.preventDefault(); setOpen(false); }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"))
                .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
              const first = controls[0];
              const last = controls.at(-1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
            }}
          >
            <div className="row row--between sheet__header">
              <h2 id={`sheet-${itemId}`} className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>{itemTitle}</h2>
              <button type="button" className="link-button sheet__close" onClick={() => setOpen(false)} aria-label="Закрыть">✕</button>
            </div>
            {priceText && <p className="serif" style={{ margin: "4px 0 12px" }}>{priceText}</p>}
            <form action={action} className="stack" noValidate>
              <div className="field">
                <label htmlFor={`guest-${itemId}`}>Как вас подписать</label>
                <input
                  ref={nameRef}
                  id={`guest-${itemId}`}
                  name="guestName"
                  className="input"
                  maxLength={40}
                  defaultValue={state.status === "error" ? (state.values.guestName ?? "") : defaultName}
                  aria-invalid={state.errors.guestName ? true : undefined}
                  aria-describedby={state.errors.guestName ? `guest-error-${itemId}` : undefined}
                  autoFocus
                  required
                />
                {state.errors.guestName && <p id={`guest-error-${itemId}`} className="error">{state.errors.guestName}</p>}
              </div>
              <p className="muted" style={{ margin: 0 }}>{ownerName} не узнает, кто дарит</p>
              <p className="muted" style={{ margin: 0 }}>
                Нажимая «Я подарю», вы соглашаетесь на обработку указанного имени по{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">политике конфиденциальности</a>.
              </p>
              {state.status === "error" && state.message && <p className="error" role="status">{state.message}</p>}
              <SubmitButton pendingText="Бронируем…">Я подарю</SubmitButton>
            </form>
          </dialog>
      )}
    </>
  );
}

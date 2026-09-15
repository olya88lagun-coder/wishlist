"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { initialFormState } from "../form-state";
import { addItemAction } from "./actions";

export function QuickLinkForm({ wishlistId }: { wishlistId: string }) {
  const [state, action] = useActionState(addItemAction.bind(null, wishlistId), initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  // Спека 3.2: на десктопе ссылку можно просто вставить Ctrl+V в любом месте страницы списка
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const text = event.clipboardData?.getData("text")?.trim() ?? "";
      if (!/^https?:\/\/\S+$/i.test(text) || !formRef.current) return;
      event.preventDefault();
      const input = formRef.current.elements.namedItem("url") as HTMLInputElement;
      input.value = text;
      formRef.current.requestSubmit();
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const error = state.errors.url ?? state.errors.title ?? (state.status === "error" ? state.message : null);

  return (
    <form ref={formRef} action={action} className="panel stack quick-link" style={{ marginBottom: 16 }} noValidate>
      <label htmlFor="quick-url" className="serif" style={{ fontSize: 20 }}>Вставьте ссылку на подарок</label>
      <div className="quick-link__row">
        <input
          id="quick-url"
          name="url"
          type="url"
          inputMode="url"
          className="input"
          placeholder="https://www.wildberries.ru/catalog/…"
          defaultValue={state.status === "error" ? (state.values.url ?? "") : ""}
          autoComplete="off"
        />
        <SubmitButton pendingText="Добавляем…">Добавить</SubmitButton>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {state.status === "success" && state.message && <p className="muted" role="status">{state.message}</p>}
    </form>
  );
}

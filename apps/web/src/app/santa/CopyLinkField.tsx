"use client";

import { useId, useRef, useState } from "react";

export function CopyLinkField({ label, value }: { label: string; value: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Ссылка скопирована");
    } catch {
      input.current?.focus();
      input.current?.select();
      setMessage("Ссылка выделена. Скопируйте её вручную.");
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="santa-copy">
        <input id={id} ref={input} className="input" readOnly value={value} onFocus={(event) => event.currentTarget.select()} />
        <button className="button button--ghost" type="button" onClick={copy}>Копировать</button>
      </div>
      <span className="santa-copy__status" role="status">{message}</span>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

export function ConfirmButton({ action, question, children, className = "link-button link-button--danger" }: {
  action: () => Promise<void>;
  question: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form action={action} onSubmit={(event) => { if (!window.confirm(question)) event.preventDefault(); }}>
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}

"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, variant = "primary" }: { children: ReactNode; pendingText: string; variant?: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  const className = variant === "ghost" ? "button button--ghost button--block" : "button button--block";
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

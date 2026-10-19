"use client";

import { useEffect, useRef } from "react";
import type { FormState } from "@/app/lists/form-state";

export function useFormErrorFocus(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status !== "error") return;
    const form = formRef.current;
    const target = form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-form-error]');
    if (!form || !target) return;
    const details = form.closest<HTMLDetailsElement>("details");
    if (details) details.open = true;
    target.focus();
  }, [state]);
  return formRef;
}

"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const MAX_DEG = 6;

// Лёгкий 3D-наклон карточек к курсору. Делегирование: карточки остаются серверными.
// shortcut: только мышь (hover: hover), на тач-экранах эффекта нет.
export function TiltCards() {
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let active: HTMLElement | null = null;
    const reset = () => {
      active?.style.removeProperty("--tilt-x");
      active?.style.removeProperty("--tilt-y");
      active?.classList.remove("is-tilting");
      active = null;
    };
    const onMove = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest<HTMLElement>(".card");
      if (card !== active) reset();
      if (!card) return;
      active = card;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      card.classList.add("is-tilting");
      card.style.setProperty("--tilt-x", `${(-py * MAX_DEG * 2).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(px * MAX_DEG * 2).toFixed(2)}deg`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", reset);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", reset);
      reset();
    };
  }, []);
  return null;
}

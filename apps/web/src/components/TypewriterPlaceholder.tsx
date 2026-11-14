"use client";

import { useEffect } from "react";
import { prefersReducedMotion, typewriterFrames } from "@/lib/motion";

type Props = { targetId: string; examples: readonly string[]; prefix?: string };

const TICK_MS = 70;

// Плейсхолдер поля сам печатает примеры, пока поле на экране, пустое и не в фокусе
export function TypewriterPlaceholder({ targetId, examples, prefix = "Например: " }: Props) {
  useEffect(() => {
    const input = document.getElementById(targetId);
    if (!(input instanceof HTMLInputElement) || prefersReducedMotion() || examples.length === 0) return;
    const original = input.placeholder;
    const frames = examples.flatMap((example) => typewriterFrames(example));
    let index = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      input.placeholder = original;
    };
    const start = () => {
      if (timer || input.value || document.activeElement === input) return;
      timer = setInterval(() => {
        if (document.hidden) return;
        input.placeholder = prefix + frames[index];
        index = (index + 1) % frames.length;
      }, TICK_MS);
    };

    const observer = new IntersectionObserver((entries) => (entries.some((entry) => entry.isIntersecting) ? start() : stop()));
    observer.observe(input);
    input.addEventListener("focus", stop);
    input.addEventListener("blur", start);
    return () => {
      observer.disconnect();
      input.removeEventListener("focus", stop);
      input.removeEventListener("blur", start);
      stop();
    };
  }, [targetId, examples, prefix]);

  return null;
}

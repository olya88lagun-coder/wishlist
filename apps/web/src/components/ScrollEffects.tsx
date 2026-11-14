"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

type Props = {
  // Какие блоки плавно появляются при прокрутке; получают класс is-visible один раз
  reveal?: string;
  // Тонкая полоска прогресса чтения под верхом окна
  progress?: boolean;
};

export function ScrollEffects({ reveal, progress = false }: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reveal) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(reveal));
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      for (const element of elements) element.classList.add("is-visible");
      return;
    }
    // То, что уже на экране, не прячем: иначе первый экран мигнёт
    for (const element of elements) {
      if (element.getBoundingClientRect().top < window.innerHeight) element.classList.add("is-visible");
    }
    document.documentElement.classList.add("js-reveal");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -10% 0px" });
    for (const element of elements) if (!element.classList.contains("is-visible")) observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("js-reveal");
    };
  }, [reveal]);

  useEffect(() => {
    const bar = barRef.current;
    if (!progress || !bar) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [progress]);

  return progress ? <div ref={barRef} className="scroll-progress" aria-hidden="true" /> : null;
}

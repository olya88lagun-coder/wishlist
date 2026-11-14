"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/motion";

// Первое открытие списка за сессию: ставит <html data-first-open>, по нему CSS раскрывает шапку как открытку
export function FirstOpenMark({ slug }: { slug: string }) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const root = document.documentElement;
    const key = `opened:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    root.dataset.firstOpen = "";
    // Без очистки в cleanup: React в dev запускает эффект дважды, и снятый сразу атрибут не успел бы сработать
    setTimeout(() => delete root.dataset.firstOpen, 2000);
  }, [slug]);
  return null;
}

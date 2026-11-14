"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/motion";

// Первое открытие списка за сессию: ставит <html data-first-open>, по нему CSS раскрывает шапку как открытку
export function FirstOpenMark({ slug }: { slug: string }) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const key = `opened:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    const root = document.documentElement;
    root.dataset.firstOpen = "";
    const timer = setTimeout(() => delete root.dataset.firstOpen, 2000);
    return () => {
      clearTimeout(timer);
      delete root.dataset.firstOpen;
    };
  }, [slug]);
  return null;
}

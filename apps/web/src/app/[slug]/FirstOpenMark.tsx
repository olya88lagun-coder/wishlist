"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const SHOW_MS = 3000;

// Первое открытие списка за сессию: поверх страницы раскрывается открытка «Для вас — вишлист …» и тает.
// Цвета берутся из --confetti-1…4 темы списка. Клик пропускает показ
export function FirstOpenMark({ slug, title, ownerName }: { slug: string; title: string; ownerName: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const key = `opened:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    setShow(true);
    // Без очистки в cleanup: React в dev запускает эффект дважды, и снятый сразу показ не успел бы сыграть
    setTimeout(() => setShow(false), SHOW_MS);
  }, [slug]);

  if (!show) return null;
  return (
    <div className="postcard" aria-hidden="true" onClick={() => setShow(false)}>
      <div className="postcard__card">
        <div className="postcard__inside">
          <span className="postcard__kicker">Для вас</span>
          <strong className="postcard__title">{title}</strong>
          <span className="postcard__owner">вишлист {ownerName}</span>
        </div>
        <div className="postcard__cover">
          <span className="postcard__seal">✦</span>
          <span className="postcard__hello">Вам открытка</span>
        </div>
      </div>
    </div>
  );
}

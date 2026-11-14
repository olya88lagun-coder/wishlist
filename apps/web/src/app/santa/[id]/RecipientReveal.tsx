"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

type Stage = "sealed" | "breaking" | "open";
const BREAK_MS = 950;

function readOpened(key: string): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}

function saveOpened(key: string) {
  try { localStorage.setItem(key, "1"); } catch { /* приватный режим: в следующий раз печать покажется снова */ }
}

// Получатель жеребьёвки под сургучной печатью: при первом открытии участник сам ломает печать,
// дальше в этом браузере имя видно сразу
export function RecipientReveal({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("sealed");
  const result = useRef<HTMLDivElement>(null);
  // Печать сломал сам человек: после открытия переводим фокус на имя (кнопка на время анимации отключена и фокус теряет)
  const byUser = useRef(false);

  useEffect(() => {
    if (readOpened(storageKey)) setStage("open");
  }, [storageKey]);

  useEffect(() => {
    if (stage !== "breaking") return;
    const timer = setTimeout(() => setStage("open"), BREAK_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage === "open" && byUser.current) result.current?.focus({ preventScroll: true });
  }, [stage]);

  function breakSeal() {
    byUser.current = true;
    saveOpened(storageKey);
    setStage(prefersReducedMotion() ? "open" : "breaking");
  }

  if (stage === "open") {
    return <div ref={result} tabIndex={-1} className="santa-reveal santa-reveal--open">{children}</div>;
  }

  return (
    <button type="button" className={`santa-seal${stage === "breaking" ? " santa-seal--breaking" : ""}`} onClick={breakSeal} disabled={stage === "breaking"}>
      <svg className="santa-seal__wax" viewBox="0 0 88 88" aria-hidden="true">
        <g className="santa-seal__half santa-seal__half--left">
          <path d="M44 4c-9 0-12 5-20 7S8 15 6 24s2 14 0 20 -4 13 0 20 9 9 15 11 10 9 23 9Z" fill="#862940" stroke="#5c1a2b" strokeWidth="2" />
        </g>
        <g className="santa-seal__half santa-seal__half--right">
          <path d="M44 4c9 0 12 5 20 7s16 4 18 13-2 14 0 20 4 13 0 20-9 9-15 11-10 9-23 9Z" fill="#862940" stroke="#5c1a2b" strokeWidth="2" />
        </g>
        <circle cx="44" cy="44" r="25" fill="none" stroke="#e2ad87" strokeWidth="1.5" />
        <path d="M44 27v34m-14.7-25.5 29.4 17m0-17-29.4 17" stroke="#f7d4a9" strokeWidth="2" strokeLinecap="round" />
        <path className="santa-seal__crack" d="m46 2-6 18 8 10-7 12 6 12-5 14 4 18" fill="none" stroke="#3a0f1d" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <span className="santa-seal__text">
        <strong>Получатель под печатью</strong>
        <span>{stage === "breaking" ? "Открываем…" : "Нажмите, чтобы сломать печать"}</span>
      </span>
    </button>
  );
}

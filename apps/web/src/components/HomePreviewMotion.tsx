"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/motion";

export function HomePreviewMotion({ children }: { children: ReactNode }) {
  const figure = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    sync();
    setReady(!prefersReducedMotion());
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReady(!preference.matches);
    const element = figure.current;
    const observer = element && "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          element.toggleAttribute("data-offscreen", !entry?.isIntersecting);
        })
      : null;
    if (element) observer?.observe(element);
    preference.addEventListener("change", syncPreference);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <figure className="home-preview" ref={figure} data-play={ready || undefined} data-paused={(!visible || paused) || undefined}>
      {children}
      {ready && (
        <button className="home-preview__pause" type="button" aria-label={paused ? "Продолжить показ примера" : "Приостановить показ примера"} onClick={() => setPaused(!paused)}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d={paused ? "M5 3l8 5-8 5z" : "M4 3h2.5v10H4zm5.5 0H12v10H9.5z"} />
          </svg>
        </button>
      )}
    </figure>
  );
}

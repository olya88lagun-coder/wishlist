"use client";

import { useEffect } from "react";
import { giftFlightOffset, prefersReducedMotion } from "@/lib/motion";
import { GIFT_ADDED_EVENT } from "./SavedIdeasDock";

export function SavedIdeaFlight() {
  useEffect(() => {
    let frame = 0;
    let active: HTMLSpanElement | null = null;

    function onAdded(event: Event) {
      if (prefersReducedMotion() || document.hidden) return;
      const { title } = (event as CustomEvent<{ title: string }>).detail;
      const headings = Array.from(document.querySelectorAll<HTMLElement>(".gift-idea h4, .gift-card h3"));
      const focusedCard = document.activeElement?.closest(".gift-idea, .gift-card");
      const heading = headings.find((item) => item.textContent?.trim() === title && focusedCard?.contains(item))
        ?? headings.find((item) => item.textContent?.trim() === title);
      if (!heading) return;
      const source = heading.getBoundingClientRect();
      if (!source.width || source.bottom < 0 || source.top > window.innerHeight) return;

      cancelAnimationFrame(frame);
      active?.remove();
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          const dock = document.querySelector(".saved-dock__icon");
          if (!dock || prefersReducedMotion()) return;
          const { x, y, dx, dy } = giftFlightOffset(source, dock.getBoundingClientRect());
          const tile = document.createElement("span");
          tile.className = "saved-idea-flight";
          tile.setAttribute("aria-hidden", "true");
          tile.textContent = title;
          tile.style.left = `${x}px`;
          tile.style.top = `${y}px`;
          tile.style.setProperty("--flight-x", `${dx}px`);
          tile.style.setProperty("--flight-y", `${dy}px`);
          tile.addEventListener("animationend", () => tile.remove(), { once: true });
          tile.addEventListener("animationcancel", () => tile.remove(), { once: true });
          document.body.append(tile);
          active = tile;
        });
      });
    }

    window.addEventListener(GIFT_ADDED_EVENT, onAdded);
    return () => {
      window.removeEventListener(GIFT_ADDED_EVENT, onAdded);
      cancelAnimationFrame(frame);
      active?.remove();
    };
  }, []);

  return null;
}

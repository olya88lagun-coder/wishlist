import { drawNotes, prefersReducedMotion } from "./motion";

const LIFETIME_MS = 2600;

const BAG_SVG = `<svg class="santa-draw__bag" viewBox="0 0 120 120" aria-hidden="true">
  <path d="M30 44c-14 18-18 40-10 56 6 12 20 16 40 16s34-4 40-16c8-16 4-38-10-56Z" fill="#862940" stroke="#5c1a2b" stroke-width="2"/>
  <path d="M34 44c8-6 44-6 52 0" fill="none" stroke="#5c1a2b" stroke-width="2"/>
  <path d="M38 38c6-10 38-10 44 0l-4 8c-8-4-28-4-36 0Z" fill="#a8394f" stroke="#5c1a2b" stroke-width="2"/>
  <path d="M42 46c8 4 28 4 36 0" fill="none" stroke="#e3be84" stroke-width="4" stroke-linecap="round"/>
  <circle cx="78" cy="50" r="5" fill="#e3be84"/>
  <path d="M48 78l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#e3be84" opacity=".8"/>
</svg>`;

// Сцена жеребьёвки: из мешка вылетают сложенные записки. Кнопка после жеребьёвки исчезает со страницы,
// поэтому слой живёт в body и убирает себя сам
export function playSantaDraw(participants: number) {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const layer = document.createElement("div");
  layer.className = "santa-draw-show";
  layer.setAttribute("aria-hidden", "true");
  const stage = document.createElement("div");
  stage.className = "santa-draw-show__stage";
  stage.innerHTML = BAG_SVG;
  const radius = Math.min(220, Math.min(window.innerWidth, window.innerHeight) * 0.38);
  for (const note of drawNotes(participants, radius)) {
    const span = document.createElement("span");
    span.className = "santa-draw-show__note";
    span.style.setProperty("--x", `${note.x}px`);
    span.style.setProperty("--y", `${note.y}px`);
    span.style.setProperty("--r", `${note.rotate}deg`);
    span.style.animationDelay = `${note.delay}ms`;
    stage.append(span);
  }
  layer.append(stage);
  document.body.append(layer);
  setTimeout(() => layer.remove(), LIFETIME_MS);
}

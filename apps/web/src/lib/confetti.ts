import { confettiPieces, prefersReducedMotion } from "./motion";

const FALLBACK_COLORS = ["#c9a45c", "#7a2234", "#e8d5b0", "#d98c8c"];
const LIFETIME_MS = 1600;

// Короткий залп конфетти из точки (по умолчанию — центр низа экрана). Цвета берутся из темы списка: --confetti-1…4
export function burstConfetti(origin?: { x: number; y: number }) {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const styles = getComputedStyle(document.body);
  const colors = [1, 2, 3, 4].map((n, index) => styles.getPropertyValue(`--confetti-${n}`).trim() || FALLBACK_COLORS[index]!);
  const layer = document.createElement("div");
  layer.className = "confetti";
  layer.setAttribute("aria-hidden", "true");
  layer.style.left = `${origin?.x ?? window.innerWidth / 2}px`;
  layer.style.top = `${origin?.y ?? window.innerHeight * 0.7}px`;
  for (const piece of confettiPieces(42, colors)) {
    const span = document.createElement("span");
    span.className = piece.wide ? "confetti__piece confetti__piece--wide" : "confetti__piece";
    span.style.background = piece.color;
    span.style.animationDelay = `${piece.delay}ms`;
    span.style.setProperty("--x", `${piece.x}px`);
    span.style.setProperty("--y", `${piece.y}px`);
    span.style.setProperty("--r", `${piece.rotate}deg`);
    layer.append(span);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), LIFETIME_MS);
}

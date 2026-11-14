// Чистые расчёты для декоративных анимаций: компоненты только рисуют то, что здесь посчитано

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function giftFlightOffset(source: DOMRectReadOnly, target: DOMRectReadOnly) {
  const x = source.left + source.width / 2;
  const y = source.top + source.height / 2;
  return { x, y, dx: target.left + target.width / 2 - x, dy: target.top + target.height / 2 - y };
}

// Кадры «печатающегося» плейсхолдера: набор по букве, пауза на полном тексте, стирание
export function typewriterFrames(text: string, holdFrames = 24): string[] {
  const chars = Array.from(text);
  const typing = chars.map((_, index) => chars.slice(0, index + 1).join(""));
  const erasing = typing.slice(0, -1).reverse().filter((_, index) => index % 2 === 0);
  return [...typing, ...Array<string>(holdFrames).fill(text), ...erasing, ""];
}

export type Flake = { left: number; delay: number; duration: number; size: number; drift: number };

export function snowflakes(count: number, random: () => number = Math.random): Flake[] {
  return Array.from({ length: count }, () => ({
    left: Math.round(random() * 1000) / 10,
    delay: -Math.round(random() * 120) / 10,
    duration: 9 + Math.round(random() * 70) / 10,
    size: 3 + Math.round(random() * 4),
    drift: Math.round(random() * 60 - 30),
  }));
}

export type ConfettiPiece = { x: number; y: number; rotate: number; delay: number; color: string; wide: boolean };

export function confettiPieces(count: number, colors: readonly string[], random: () => number = Math.random): ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 0.9;
    const power = 160 + random() * 220;
    return {
      x: Math.round(Math.cos(angle) * power),
      y: Math.round(Math.sin(angle) * power),
      rotate: Math.round(random() * 720 - 360),
      delay: Math.round(random() * 120),
      color: colors[index % colors.length] ?? "#c9a45c",
      wide: random() > 0.5,
    };
  });
}

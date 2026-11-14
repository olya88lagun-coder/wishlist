import { describe, expect, it } from "vitest";
import { confettiPieces, snowflakes, typewriterFrames } from "./motion";

describe("typewriterFrames", () => {
  it("types, holds, erases and ends empty", () => {
    const frames = typewriterFrames("кот", 2);
    expect(frames.slice(0, 5)).toEqual(["к", "ко", "кот", "кот", "кот"]);
    expect(frames.at(-1)).toBe("");
    expect(frames.every((frame) => "кот".startsWith(frame))).toBe(true);
  });

  it("keeps emoji and other multi-unit characters whole", () => {
    expect(typewriterFrames("🎁a", 0)[0]).toBe("🎁");
  });
});

describe("snowflakes", () => {
  it("stays inside the layer", () => {
    for (const flake of snowflakes(50)) {
      expect(flake.left).toBeGreaterThanOrEqual(0);
      expect(flake.left).toBeLessThanOrEqual(100);
      expect(flake.delay).toBeLessThanOrEqual(0);
      expect(flake.duration).toBeGreaterThan(0);
    }
  });
});

describe("confettiPieces", () => {
  it("cycles colors and flies upward", () => {
    const pieces = confettiPieces(6, ["a", "b"], () => 0.5);
    expect(pieces.map((piece) => piece.color)).toEqual(["a", "b", "a", "b", "a", "b"]);
    expect(pieces.every((piece) => piece.y < 0)).toBe(true);
  });
});

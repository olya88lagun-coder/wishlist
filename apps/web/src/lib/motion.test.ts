import { describe, expect, it } from "vitest";
import { confettiPieces, drawNotes, giftFlightOffset, snowflakes, typewriterFrames } from "./motion";

describe("giftFlightOffset", () => {
  it("connects the centers of the source and destination without assuming a direction", () => {
    const source = { left: 100, top: 500, width: 200, height: 30 } as DOMRectReadOnly;
    const target = { left: 300, top: 400, width: 20, height: 20 } as DOMRectReadOnly;
    expect(giftFlightOffset(source, target)).toEqual({ x: 200, y: 515, dx: 110, dy: -105 });
  });
});

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

describe("drawNotes", () => {
  it("caps the notes, fans them above the bag and staggers them", () => {
    const notes = drawNotes(30, 200, () => 0.5);
    expect(notes).toHaveLength(12);
    expect(notes.every((note) => note.y < 0)).toBe(true);
    expect(notes[0]!.x).toBeLessThan(0);
    expect(notes.at(-1)!.x).toBeGreaterThan(0);
    expect(notes[1]!.delay).toBeGreaterThan(notes[0]!.delay);
  });

  it("shows at least one note", () => {
    expect(drawNotes(0, 100)).toHaveLength(1);
  });
});

import { PNG } from "pngjs";
import { expect, test, vi } from "vitest";
import type { DedMorozLetterInput } from "../lib/ded-moroz-letter";
import { renderDedMorozLetter } from "./ded-moroz-letter-image";

test.each<DedMorozLetterInput>([
  { name: "Миша", gender: "boy", age: "4" },
  { name: "Маша", gender: "girl", age: "4", achievements: ["научилась плавать"], gift: "самокат" },
  { name: "Ш".repeat(30), gender: "boy", age: "17", achievements: ["Ж".repeat(70), "Ж".repeat(70), "Ж".repeat(70)], gift: "Ж".repeat(60), wish: "Ж".repeat(160) },
  { name: "W".repeat(30), gender: "girl", age: "9", achievements: Array(3).fill("W".repeat(70)), gift: "W".repeat(60), wish: "W".repeat(160) },
  { name: "Щ".repeat(30), gender: "girl", age: "5", achievements: Array(3).fill("Щ".repeat(70)), gift: "Щ".repeat(60), wish: "Щ".repeat(160) },
  { name: "Аня 🎄", gender: "girl", age: "8", wish: "Привет 👋 你好" },
])("renders A4 PNG without network: $name", async (input) => {
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External request forbidden"));
  try {
    const response = await renderDedMorozLetter(input);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(bytes.readUInt32BE(16)).toBe(1240);
    expect(bytes.readUInt32BE(20)).toBe(1754);
    const { data, width, height } = PNG.sync.read(bytes);
    const sealRows: number[] = [];
    for (let y = height - 300; y < height; y++) {
      for (let x = 120; x < 245; x++) {
        const i = (y * width + x) * 4;
        if (data[i] === 133 && data[i + 1] === 47 && data[i + 2] === 66) {
          sealRows.push(y);
          break;
        }
      }
    }
    expect(sealRows.length).toBeGreaterThan(105);
    expect(sealRows.at(-1)).toBeLessThan(height - 62);
    const forestEdges = { left: width, right: 0 };
    for (let y = 800; y < height - 250; y += 3) {
      for (let x = 104; x < width - 104; x += 3) {
        const i = (y * width + x) * 4;
        const [red, green, blue] = [data[i]!, data[i + 1]!, data[i + 2]!];
        if (red < 120 && green > red + 2 && green > blue + 10) {
          forestEdges.left = Math.min(forestEdges.left, x);
          forestEdges.right = Math.max(forestEdges.right, x);
        }
      }
    }
    expect(forestEdges.right - forestEdges.left).toBeGreaterThan(900);
    expect(network.mock.calls.map(([url]) => String(url)).filter((url) => !url.startsWith("data:"))).toEqual([]);
  } finally {
    network.mockRestore();
  }
});

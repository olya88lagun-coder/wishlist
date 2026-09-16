import { ImageResponse } from "next/og";
import { expect, test } from "vitest";
import { loadOgFonts, OG_SIZE, ogImageElement } from "./og-render";

const MODEL = { eyebrow: "список Маши", title: "Маше 30", items: "3 подарка", countdown: "ДР через 7 дней" };

test("renders a PNG of the expected size that fits into messenger limits", async () => {
  const response = new ImageResponse(ogImageElement(MODEL), { ...OG_SIZE, fonts: await loadOgFonts() });
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.byteLength).toBeLessThan(300_000);
  expect(response.headers.get("content-type")).toBe("image/png");
}, 30_000);

test("works without a countdown", async () => {
  const response = new ImageResponse(ogImageElement({ ...MODEL, countdown: null }), { ...OG_SIZE, fonts: await loadOgFonts() });
  expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
}, 30_000);

import { expect, test, vi } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { invitationSchema } from "../lib/invitation";
import { renderInvitation } from "./invitation-image";

test.each([
  { name: "Маша", date: "2028-02-29", time: "14:30" },
  { color: "pink", name: "Маша", date: "2028-02-29", time: "14:30" },
  { name: "Ш".repeat(40), age: "99", date: "2028-12-31", time: "23:59", place: "Ш".repeat(120), message: "Ж".repeat(180) },
  { name: "Аня 🎉", age: "1", date: "2028-01-01", time: "00:00", message: "Приходи!\n".repeat(20) },
  { name: "小明", date: "2028-01-01", time: "12:00", message: "Привет 👋 مرحبا 你好" },
])("renders real private PNG 1080×1440 without network: $name", async (raw) => {
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External request forbidden"));
  try {
    const response = await renderInvitation(invitationSchema.parse(raw), "https://my-wish-list.online/masha");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bytes.toString("ascii", 12, 16)).toBe("IHDR");
    expect(bytes.readUInt32BE(16)).toBe(1080);
    expect(bytes.readUInt32BE(20)).toBe(1440);
    expect(bytes.byteLength).toBeGreaterThan(10_000);
    expect(bytes.byteLength).toBeLessThan(2_000_000);
    const png = PNG.sync.read(bytes);
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(code?.data).toBe("https://my-wish-list.online/masha");
    // The bundled WASM loader may call fetch(data:...) before falling back locally.
    expect(network.mock.calls.map(([url]) => String(url)).filter((url) => !url.startsWith("data:"))).toEqual([]);
  } finally {
    network.mockRestore();
  }
});

test("color choice changes the actual PNG", async () => {
  const input = { name: "Маша", date: "2028-02-29", time: "14:30" };
  const url = "https://my-wish-list.online/masha";
  const blue = Buffer.from(await (await renderInvitation(invitationSchema.parse(input), url)).arrayBuffer());
  const pink = Buffer.from(await (await renderInvitation(invitationSchema.parse({ ...input, color: "pink" }), url)).arrayBuffer());
  expect(blue.equals(pink)).toBe(false);
});

import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { IMAGE_MAX_HEIGHT, IMAGE_MAX_WIDTH, itemImageKey, previewImageKey, toPreviewJpeg, toWebp } from "./images";

const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#d4537e" } }).png().toBuffer();

describe("toWebp", () => {
  test("fits large photos into 800×1000 as webp", async () => {
    const output = await toWebp(await png(2400, 2400));
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(IMAGE_MAX_WIDTH);
    expect(meta.height).toBe(IMAGE_MAX_WIDTH);
  });

  test("keeps small photos at their size", async () => {
    const meta = await sharp(await toWebp(await png(300, 500))).metadata();
    expect([meta.width, meta.height]).toEqual([300, 500]);
  });

  test("tall photos are limited by height", async () => {
    const meta = await sharp(await toWebp(await png(1000, 4000))).metadata();
    expect(meta.height).toBe(IMAGE_MAX_HEIGHT);
  });

  test("rejects bytes that are not an image", async () => {
    await expect(toWebp(new TextEncoder().encode("<html>не картинка</html>"))).rejects.toThrow();
  });
});

test("image keys live under the item id", () => {
  expect(itemImageKey("0b6f6c1e-8a4e-4a57-9d31-6a2c1f2b7e10", "11111111-2222-4333-8444-555555555555")).toBe(
    "items/0b6f6c1e-8a4e-4a57-9d31-6a2c1f2b7e10/11111111-2222-4333-8444-555555555555.webp",
  );
  expect(itemImageKey("a")).toMatch(/^items\/a\/[0-9a-f-]{36}\.webp$/);
});

test("a jpeg copy of the photo for Telegram previews, which do not render webp", async () => {
  const meta = await sharp(await toPreviewJpeg(await png(2400, 2400))).metadata();
  expect(meta.format).toBe("jpeg");
  expect(meta.width).toBe(IMAGE_MAX_WIDTH);
});

test("the preview copy lives next to the photo", () => {
  expect(previewImageKey("items/a/p.webp")).toBe("items/a/p.jpg");
});

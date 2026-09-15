import { randomUUID } from "node:crypto";
import sharp from "sharp";

export const IMAGE_MAX_WIDTH = 800;
export const IMAGE_MAX_HEIGHT = 1000;
export const IMAGE_QUALITY = 80;
export const MAX_INPUT_PIXELS = 40_000_000;

export async function toWebp(input: Uint8Array): Promise<Buffer> {
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer();
}

export function itemImageKey(itemId: string, random: string = randomUUID()): string {
  return `items/${itemId}/${random}.webp`;
}

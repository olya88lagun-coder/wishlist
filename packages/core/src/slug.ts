import { randomBytes } from "node:crypto";

export const SLUG_LENGTH = 10;
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
// 248 = наибольшее кратное 62, не превышающее 256: отбрасываем остальные байты, чтобы не было смещения
const UNBIASED_LIMIT = 248;

export function generateSlug(): string {
  let slug = "";
  while (slug.length < SLUG_LENGTH) {
    for (const byte of randomBytes(SLUG_LENGTH * 2)) {
      if (byte < UNBIASED_LIMIT && slug.length < SLUG_LENGTH) slug += ALPHABET[byte % ALPHABET.length];
    }
  }
  return slug;
}

export function isValidSlug(value: string): boolean {
  return /^[0-9A-Za-z]{10}$/.test(value);
}

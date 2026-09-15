import { createHmac, timingSafeEqual } from "node:crypto";

// Параметр /start в Telegram — до 64 символов [A-Za-z0-9_-]: "r" + uuid в base64url (22) + подпись (16)
const PREFIX = "r";
const ID_LENGTH = 22;
const SIGNATURE_BYTES = 12;
const PAYLOAD_LENGTH = PREFIX.length + ID_LENGTH + 16;

function signature(idPart: string, secret: string): Buffer {
  const key = createHmac("sha256", secret).update("reminder-link").digest();
  return createHmac("sha256", key).update(idPart).digest().subarray(0, SIGNATURE_BYTES);
}

export function signReminderPayload(reservationId: string, secret: string): string {
  const idPart = Buffer.from(reservationId.replace(/-/g, ""), "hex").toString("base64url");
  return `${PREFIX}${idPart}${signature(idPart, secret).toString("base64url")}`;
}

export function verifyReminderPayload(payload: string, secret: string): string | null {
  if (payload.length !== PAYLOAD_LENGTH || !payload.startsWith(PREFIX)) return null;
  const idPart = payload.slice(PREFIX.length, PREFIX.length + ID_LENGTH);
  const actual = Buffer.from(payload.slice(PREFIX.length + ID_LENGTH), "base64url");
  const expected = signature(idPart, secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const hex = Buffer.from(idPart, "base64url").toString("hex");
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

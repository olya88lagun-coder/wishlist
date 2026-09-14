import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 86400;

export type TelegramUser = {
  id: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
};

export type TelegramVerifyResult =
  | { ok: true; user: TelegramUser }
  | { ok: false; reason: "MISSING_HASH" | "BAD_HASH" | "EXPIRED" | "MALFORMED" };

type Checked = { ok: true; fields: Map<string, string> } | { ok: false; reason: "MISSING_HASH" | "BAD_HASH" | "EXPIRED" };

function checkSignature(params: URLSearchParams, secretKey: Buffer, now: Date, maxAgeSeconds: number): Checked {
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "MISSING_HASH" };
  const fields = new Map<string, string>();
  for (const [key, value] of params) if (key !== "hash") fields.set(key, value);
  const dataCheckString = [...fields.keys()].sort().map((k) => `${k}=${fields.get(k)}`).join("\n");
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, reason: "BAD_HASH" };
  const authDate = Number(fields.get("auth_date"));
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDate;
  if (!Number.isFinite(authDate) || ageSeconds > maxAgeSeconds) return { ok: false, reason: "EXPIRED" };
  return { ok: true, fields };
}

type RawTelegramUser = { id?: unknown; first_name?: unknown; last_name?: unknown; username?: unknown; photo_url?: unknown };

function toUser(raw: RawTelegramUser): TelegramUser | null {
  const id = Number(raw.id);
  if (!Number.isSafeInteger(id) || typeof raw.first_name !== "string") return null;
  const optional = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  return { id, firstName: raw.first_name, lastName: optional(raw.last_name), username: optional(raw.username), photoUrl: optional(raw.photo_url) };
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  now: Date,
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS,
): TelegramVerifyResult {
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const checked = checkSignature(new URLSearchParams(initData), secretKey, now, maxAgeSeconds);
  if (!checked.ok) return checked;
  const userJson = checked.fields.get("user");
  if (!userJson) return { ok: false, reason: "MALFORMED" };
  try {
    const user = toUser(JSON.parse(userJson) as RawTelegramUser);
    return user ? { ok: true, user } : { ok: false, reason: "MALFORMED" };
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
}

export function verifyTelegramLoginWidget(
  params: URLSearchParams,
  botToken: string,
  now: Date,
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS,
): TelegramVerifyResult {
  const secretKey = createHash("sha256").update(botToken).digest();
  const checked = checkSignature(params, secretKey, now, maxAgeSeconds);
  if (!checked.ok) return checked;
  const user = toUser(Object.fromEntries(checked.fields));
  return user ? { ok: true, user } : { ok: false, reason: "MALFORMED" };
}

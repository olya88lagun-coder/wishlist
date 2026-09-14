import { createHash, createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifyTelegramInitData, verifyTelegramLoginWidget } from "./telegram";

const BOT_TOKEN = "123456:TEST-TOKEN";
const NOW = new Date("2026-09-14T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function dataCheckString(fields: Record<string, string>): string {
  return Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
}

function signInitData(fields: Record<string, string>): string {
  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString(fields)).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

function signWidget(fields: Record<string, string>): URLSearchParams {
  const secret = createHash("sha256").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString(fields)).digest("hex");
  return new URLSearchParams({ ...fields, hash });
}

const tgUserJson = JSON.stringify({ id: 42, first_name: "Маша", last_name: "Иванова", username: "masha", photo_url: "https://t.me/i/u.jpg" });

describe("verifyTelegramInitData", () => {
  test("accepts correctly signed fresh init data", () => {
    const initData = signInitData({ auth_date: String(nowSec - 60), query_id: "q1", user: tgUserJson });
    expect(verifyTelegramInitData(initData, BOT_TOKEN, NOW)).toEqual({
      ok: true,
      user: { id: 42, firstName: "Маша", lastName: "Иванова", username: "masha", photoUrl: "https://t.me/i/u.jpg" },
    });
  });

  test("rejects tampered data", () => {
    const initData = signInitData({ auth_date: String(nowSec), user: tgUserJson }).replace("masha", "hacker");
    expect(verifyTelegramInitData(initData, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects data signed for another bot", () => {
    const initData = signInitData({ auth_date: String(nowSec), user: tgUserJson });
    expect(verifyTelegramInitData(initData, "999:OTHER", NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects stale data", () => {
    const initData = signInitData({ auth_date: String(nowSec - 86401), user: tgUserJson });
    expect(verifyTelegramInitData(initData, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  test("rejects missing hash and missing user", () => {
    expect(verifyTelegramInitData("auth_date=1", BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "MISSING_HASH" });
    const noUser = signInitData({ auth_date: String(nowSec) });
    expect(verifyTelegramInitData(noUser, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "MALFORMED" });
  });
});

describe("verifyTelegramLoginWidget", () => {
  test("accepts correctly signed widget params", () => {
    const params = signWidget({ id: "42", first_name: "Маша", username: "masha", auth_date: String(nowSec) });
    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({
      ok: true,
      user: { id: 42, firstName: "Маша", lastName: null, username: "masha", photoUrl: null },
    });
  });

  test("rejects init-data style signature used for the widget", () => {
    const initDataSigned = new URLSearchParams(signInitData({ id: "42", first_name: "Маша", auth_date: String(nowSec) }));
    expect(verifyTelegramLoginWidget(initDataSigned, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects stale widget params", () => {
    const params = signWidget({ id: "42", first_name: "Маша", auth_date: String(nowSec - 90000) });
    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "EXPIRED" });
  });
});

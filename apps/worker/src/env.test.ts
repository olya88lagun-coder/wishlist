import { describe, expect, test } from "vitest";
import { readWorkerEnv } from "./env";

const DB = { DATABASE_URL: "postgres://wishlist:secret@db:5432/wishlist" };
const S3 = { S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secret", S3_IMAGES_BUCKET: "wishlist-images", S3_BACKUPS_BUCKET: "wishlist-backups" };
const TG = { TELEGRAM_BOT_TOKEN: "123456:ABC-def_1", APP_URL: "https://my-wish-list.online", SESSION_SECRET: "s".repeat(32) };

describe("readWorkerEnv", () => {
  test("S3 with Timeweb defaults", () => {
    expect(readWorkerEnv({ ...DB, ...S3, S3_PUBLIC_BASE_URL: "https://s3.twcstorage.ru/wishlist-images" })).toEqual({
      DATABASE_URL: DB.DATABASE_URL,
      s3: { endpoint: "https://s3.twcstorage.ru", region: "ru-1", accessKeyId: "key", secretAccessKey: "secret", imagesBucket: "wishlist-images", backupsBucket: "wishlist-backups" },
      telegram: null,
      imagesPublicBaseUrl: "https://s3.twcstorage.ru/wishlist-images",
    });
  });

  test("no S3 and no bot token disable photos, backups and the bot", () => {
    expect(readWorkerEnv(DB)).toEqual({ DATABASE_URL: DB.DATABASE_URL, s3: null, telegram: null, imagesPublicBaseUrl: null });
  });

  test("bot token enables Telegram with an optional admin", () => {
    expect(readWorkerEnv({ ...DB, ...TG }).telegram).toEqual({ token: TG.TELEGRAM_BOT_TOKEN, appUrl: TG.APP_URL, sessionSecret: TG.SESSION_SECRET, adminId: null });
    expect(readWorkerEnv({ ...DB, ...TG, ADMIN_TELEGRAM_ID: "555001" }).telegram?.adminId).toBe(555001);
  });

  test("half-configured S3 or bot and missing database are errors that do not echo secrets", () => {
    expect(() => readWorkerEnv({ ...DB, S3_ACCESS_KEY_ID: "key" })).toThrow("S3_SECRET_ACCESS_KEY, S3_IMAGES_BUCKET, S3_BACKUPS_BUCKET");
    expect(() => readWorkerEnv({ ...S3 })).toThrow(/DATABASE_URL/);
    expect(() => readWorkerEnv({ ...DB, S3_ACCESS_KEY_ID: "key" })).not.toThrow(/key\b/);
    expect(() => readWorkerEnv({ ...DB, TELEGRAM_BOT_TOKEN: TG.TELEGRAM_BOT_TOKEN })).toThrow("Incomplete Telegram configuration, missing: APP_URL, SESSION_SECRET");
    expect(() => readWorkerEnv({ ...DB, TELEGRAM_BOT_TOKEN: TG.TELEGRAM_BOT_TOKEN })).not.toThrow(/ABC/);
  });
});

import { describe, expect, test } from "vitest";
import { readWorkerEnv } from "./env";

const DB = { DATABASE_URL: "postgres://wishlist:secret@db:5432/wishlist" };
const S3 = { S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secret", S3_IMAGES_BUCKET: "wishlist-images", S3_BACKUPS_BUCKET: "wishlist-backups" };

describe("readWorkerEnv", () => {
  test("S3 with Timeweb defaults", () => {
    expect(readWorkerEnv({ ...DB, ...S3 })).toEqual({
      DATABASE_URL: DB.DATABASE_URL,
      s3: { endpoint: "https://s3.twcstorage.ru", region: "ru-1", accessKeyId: "key", secretAccessKey: "secret", imagesBucket: "wishlist-images", backupsBucket: "wishlist-backups" },
    });
  });

  test("no S3 at all disables photos and backups", () => {
    expect(readWorkerEnv(DB)).toEqual({ DATABASE_URL: DB.DATABASE_URL, s3: null });
  });

  test("half-configured S3 and missing database are errors that do not echo secrets", () => {
    expect(() => readWorkerEnv({ ...DB, S3_ACCESS_KEY_ID: "key" })).toThrow("S3_SECRET_ACCESS_KEY, S3_IMAGES_BUCKET, S3_BACKUPS_BUCKET");
    expect(() => readWorkerEnv({ ...S3 })).toThrow(/DATABASE_URL/);
    expect(() => readWorkerEnv({ ...DB, S3_ACCESS_KEY_ID: "key" })).not.toThrow(/key\b/);
  });
});

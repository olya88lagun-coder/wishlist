import { describe, expect, test } from "vitest";
import { backupKey, expiredBackupKeys, pgEnvFromUrl } from "./backup";

describe("backupKey", () => {
  test("is sortable and safe for S3", () => {
    expect(backupKey(new Date("2026-09-16T00:00:00.000Z"))).toBe("db/wishlist-2026-09-16T00-00-00-000Z.sql.gz");
  });
});

describe("expiredBackupKeys", () => {
  test("keeps the last 14 days and ignores foreign files", () => {
    const now = new Date("2026-09-30T00:00:00.000Z");
    const keys = [
      "db/wishlist-2026-09-15T00-00-00-000Z.sql.gz",
      "db/wishlist-2026-09-16T00-00-00-000Z.sql.gz",
      "db/wishlist-2026-09-29T00-00-00-000Z.sql.gz",
      "db/readme.txt",
    ];
    expect(expiredBackupKeys(keys, now)).toEqual(["db/wishlist-2026-09-15T00-00-00-000Z.sql.gz"]);
  });
});

describe("pgEnvFromUrl", () => {
  test("splits the connection string, decoding the password", () => {
    expect(pgEnvFromUrl("postgres://wishlist:p%40ss%3Aw0rd@db:5432/wishlist")).toEqual({
      PGHOST: "db",
      PGPORT: "5432",
      PGUSER: "wishlist",
      PGPASSWORD: "p@ss:w0rd",
      PGDATABASE: "wishlist",
    });
    expect(pgEnvFromUrl("postgres://u:p@localhost/app").PGPORT).toBe("5432");
  });
});

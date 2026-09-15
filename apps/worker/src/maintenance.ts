import { type Database, pruneParseCache } from "@wishlist/db";
import { BACKUP_PREFIX, backupKey, dumpDatabase, expiredBackupKeys } from "./backup";
import type { Logger } from "./log";
import type { ObjectStorage } from "./storage";

export const MAINTENANCE_CRON = "0 3 * * *";
export const MAINTENANCE_TZ = "Europe/Moscow";

export type MaintenanceDeps = {
  db: Database;
  databaseUrl: string;
  storage: ObjectStorage | null;
  backupsBucket: string | null;
  log: Logger;
  now?: () => Date;
};

export async function runMaintenance(deps: MaintenanceDeps): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const pruned = await pruneParseCache(deps.db, now);
  deps.log("info", "parse cache pruned", { rows: pruned });

  if (!deps.storage || !deps.backupsBucket) {
    deps.log("warn", "backup skipped: S3 is not configured");
    return;
  }
  const dump = await dumpDatabase(deps.databaseUrl);
  const key = backupKey(now);
  await deps.storage.put(deps.backupsBucket, key, dump, { contentType: "application/gzip" });
  const expired = expiredBackupKeys(await deps.storage.list(deps.backupsBucket, BACKUP_PREFIX), now);
  await deps.storage.remove(deps.backupsBucket, expired);
  deps.log("info", "backup stored", { key, bytes: dump.length, removed: expired.length });
}

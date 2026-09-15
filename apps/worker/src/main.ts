import { type ParseItemJob, QUEUES } from "@wishlist/core";
import { createDb } from "@wishlist/db";
import { createHostThrottle, createSafeFetcher, parseProduct } from "@wishlist/parser";
import { PgBoss } from "pg-boss";
import sharp from "sharp";
import { readWorkerEnv } from "./env";
import { log } from "./log";
import { MAINTENANCE_CRON, MAINTENANCE_TZ, runMaintenance } from "./maintenance";
import { runParseItem } from "./parse-item";
import { createS3Storage } from "./storage";

const PARSE_CONCURRENCY = 2;
const HOST_INTERVAL_MS = 2000;
const DB_POOL = 3;
const SHUTDOWN_TIMEOUT_MS = 20_000;

const env = readWorkerEnv();

// 200 МБ на контейнер: одна картинка за раз и без кэша libvips
sharp.cache(false);
sharp.concurrency(1);

const db = createDb(env.DATABASE_URL, { maxConnections: DB_POOL });
const fetcher = createSafeFetcher();
const waitTurn = createHostThrottle(HOST_INTERVAL_MS);
const storage = env.s3 ? createS3Storage(env.s3) : null;
if (!storage) log("warn", "S3 is not configured: photos and backups are disabled");

const maintenanceDeps = { db, databaseUrl: env.DATABASE_URL, storage, backupsBucket: env.s3?.backupsBucket ?? null, log };

if (process.argv.includes("--maintenance-once")) {
  await runMaintenance(maintenanceDeps);
  await fetcher.close();
  process.exit(0);
}

const boss = new PgBoss({ connectionString: env.DATABASE_URL, max: DB_POOL });
boss.on("error", (error) => log("error", "pg-boss error", { error: String(error) }));

await boss.start();
await boss.createQueue(QUEUES.parseItem);
await boss.createQueue(QUEUES.maintenance);

await boss.work<ParseItemJob>(QUEUES.parseItem, { localConcurrency: PARSE_CONCURRENCY }, async ([job]) => {
  if (!job) return;
  try {
    await runParseItem(job.data.itemId, {
      db,
      parse: (url) => parseProduct(url, { fetchPage: fetcher.fetchPage, waitTurn }),
      fetchImage: async (url) => {
        await waitTurn(url);
        return fetcher.fetchImage(url);
      },
      images: storage && env.s3 ? { storage, bucket: env.s3.imagesBucket } : null,
      log,
    });
  } catch (error) {
    // pg-boss сам пометит задачу failed, но в лог контейнера ничего не попадёт
    log("error", "parse job failed", { itemId: job.data.itemId, error: String(error) });
    throw error;
  }
});

await boss.work(QUEUES.maintenance, async () => {
  await runMaintenance(maintenanceDeps);
});
await boss.schedule(QUEUES.maintenance, MAINTENANCE_CRON, {}, { tz: MAINTENANCE_TZ });

log("info", "worker started", { parseConcurrency: PARSE_CONCURRENCY, s3: storage !== null });

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", "worker stopping", { signal });
  await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
  await fetcher.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

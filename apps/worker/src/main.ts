import { NOTIFY_JOB_OPTIONS, PARSE_JOB_OPTIONS, QUEUES } from "@wishlist/core";
import { createDb } from "@wishlist/db";
import { createHostThrottle, createSafeFetcher } from "@wishlist/parser";
import { PgBoss } from "pg-boss";
import sharp from "sharp";
import { createTelegramBot } from "./bot/create-bot";
import { readWorkerEnv } from "./env";
import { PARSE_CONCURRENCY, registerJobs } from "./jobs";
import { log } from "./log";
import { runMaintenance } from "./maintenance";
import { createS3Storage } from "./storage";
import { createMessenger } from "./telegram/messenger";

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

if (process.argv.includes("--maintenance-once")) {
  await runMaintenance({ db, databaseUrl: env.DATABASE_URL, storage, backupsBucket: env.s3?.backupsBucket ?? null, log });
  await fetcher.close();
  process.exit(0);
}

const boss = new PgBoss({ connectionString: env.DATABASE_URL, max: DB_POOL });
boss.on("error", (error) => log("error", "pg-boss error", { error: String(error) }));
await boss.start();

const bot = env.telegram
  ? await createTelegramBot({
      config: env.telegram,
      db,
      log,
      imagesPublicBaseUrl: env.imagesPublicBaseUrl,
      enqueueParse: async (job) => void (await boss.send(QUEUES.parseItem, job, PARSE_JOB_OPTIONS)),
      enqueueNotify: async (job) => void (await boss.send(QUEUES.notify, job, NOTIFY_JOB_OPTIONS)),
    })
  : null;
if (!bot) log("warn", "Telegram bot is disabled: bot features and notifications are off");

await registerJobs(boss, {
  db,
  databaseUrl: env.DATABASE_URL,
  fetcher,
  waitTurn,
  storage,
  s3: env.s3,
  telegram: bot ? env.telegram : null,
  imagesPublicBaseUrl: env.imagesPublicBaseUrl,
  messenger: bot ? createMessenger(bot.api) : null,
  log,
});

// Очереди созданы — теперь можно принимать сообщения, которые ставят задачи
if (bot) {
  void bot
    .start({ allowed_updates: ["message", "callback_query", "inline_query"], onStart: () => log("info", "bot polling started") })
    .catch((error: unknown) => log("error", "bot polling stopped", { error: String(error) }));
}

log("info", "worker started", { parseConcurrency: PARSE_CONCURRENCY, s3: storage !== null, telegram: bot !== null });

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", "worker stopping", { signal });
  await bot?.stop();
  await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
  await fetcher.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

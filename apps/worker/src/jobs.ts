import { type NotifyJob, type ParseItemJob, QUEUES } from "@wishlist/core";
import type { Database } from "@wishlist/db";
import { parseProduct, type SafeFetcher } from "@wishlist/parser";
import type { PgBoss } from "pg-boss";
import { updateItemCardMessage } from "./bot/card";
import type { S3Config, TelegramConfig } from "./env";
import type { Logger } from "./log";
import { MAINTENANCE_CRON, MAINTENANCE_TZ, runMaintenance } from "./maintenance";
import { runNotify } from "./notify";
import { runParseItem } from "./parse-item";
import { REMINDERS_CRON, runReminders } from "./reminders";
import type { ObjectStorage } from "./storage";
import type { Messenger } from "./telegram/messenger";

export const PARSE_CONCURRENCY = 2;

export type JobDeps = {
  db: Database;
  databaseUrl: string;
  fetcher: SafeFetcher;
  waitTurn(url: string): Promise<void>;
  storage: ObjectStorage | null;
  s3: S3Config | null;
  telegram: TelegramConfig | null;
  imagesPublicBaseUrl: string | null;
  messenger: Messenger | null;
  log: Logger;
};

async function parseJob(job: ParseItemJob, deps: JobDeps): Promise<void> {
  await runParseItem(job.itemId, {
    db: deps.db,
    parse: (url) => parseProduct(url, { fetchPage: deps.fetcher.fetchPage, waitTurn: deps.waitTurn }),
    fetchImage: async (url) => {
      await deps.waitTurn(url);
      return deps.fetcher.fetchImage(url);
    },
    images: deps.storage && deps.s3 ? { storage: deps.storage, bucket: deps.s3.imagesBucket } : null,
    log: deps.log,
  });
  if (!job.botMessage || !deps.messenger || !deps.telegram) return;
  // Карточка в чате — удобство: ошибка редактирования не должна повторять парсинг
  await updateItemCardMessage(
    { db: deps.db, messenger: deps.messenger, appUrl: deps.telegram.appUrl, imagesPublicBaseUrl: deps.imagesPublicBaseUrl, log: deps.log },
    job.itemId,
    job.botMessage,
  ).catch((error: unknown) => deps.log("warn", "bot card update crashed", { itemId: job.itemId, error: String(error) }));
}

export async function registerJobs(boss: PgBoss, deps: JobDeps): Promise<void> {
  for (const name of Object.values(QUEUES)) await boss.createQueue(name);

  await boss.work<ParseItemJob>(QUEUES.parseItem, { localConcurrency: PARSE_CONCURRENCY }, async ([job]) => {
    if (!job) return;
    try {
      await parseJob(job.data, deps);
    } catch (error) {
      // pg-boss сам пометит задачу failed, но в лог контейнера ничего не попадёт
      deps.log("error", "parse job failed", { itemId: job.data.itemId, error: String(error) });
      throw error;
    }
  });

  await boss.work<NotifyJob>(QUEUES.notify, async ([job]) => {
    // Без бота уведомления некуда отправлять — задача просто завершается
    if (!job || !deps.messenger || !deps.telegram) return;
    try {
      await runNotify(job.data, { db: deps.db, messenger: deps.messenger, appUrl: deps.telegram.appUrl, now: () => new Date(), log: deps.log });
    } catch (error) {
      deps.log("warn", "notify job failed", { kind: job.data.kind, itemId: job.data.itemId, error: String(error) });
      throw error;
    }
  });

  const maintenanceDeps = {
    db: deps.db,
    databaseUrl: deps.databaseUrl,
    storage: deps.storage,
    backupsBucket: deps.s3?.backupsBucket ?? null,
    log: deps.log,
  };
  await boss.work(QUEUES.maintenance, async () => {
    await runMaintenance(maintenanceDeps);
  });
  await boss.schedule(QUEUES.maintenance, MAINTENANCE_CRON, {}, { tz: MAINTENANCE_TZ });

  await boss.work(QUEUES.reminders, async () => {
    if (!deps.messenger || !deps.telegram) return;
    await runReminders({ db: deps.db, messenger: deps.messenger, appUrl: deps.telegram.appUrl, now: () => new Date(), log: deps.log });
  });
  await boss.schedule(QUEUES.reminders, REMINDERS_CRON, {}, { tz: MAINTENANCE_TZ });
}

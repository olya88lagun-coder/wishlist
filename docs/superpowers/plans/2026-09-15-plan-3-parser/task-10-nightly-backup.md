# Task 10: Ночной бэкап базы в S3 и чистка кэша

**Files:**
- Create: `apps/worker/src/backup.ts`, `apps/worker/src/maintenance.ts`
- Test: `apps/worker/src/backup.test.ts`
- Modify: `apps/worker/src/main.ts`, `apps/web/Dockerfile`, `deploy/server-setup.md`

**Interfaces:**
- Consumes: `QUEUES.maintenance` (Task 6); `ObjectStorage`, `log`, `Logger` (Task 6); `pruneParseCache` (Task 5); `WorkerEnv` (Task 7).
- Produces:
  ```ts
  // backup.ts
  const BACKUP_PREFIX = "db/";
  const BACKUP_KEEP_DAYS = 14;
  const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
  function backupKey(now: Date): string;                                   // db/wishlist-2026-09-16T00-00-00-000Z.sql.gz
  function expiredBackupKeys(keys: string[], now: Date, keepDays?: number): string[];
  function pgEnvFromUrl(databaseUrl: string): Record<"PGHOST" | "PGPORT" | "PGUSER" | "PGPASSWORD" | "PGDATABASE", string>;
  function dumpDatabase(databaseUrl: string): Promise<Buffer>;              // gzip-сжатый plain SQL
  // maintenance.ts
  type MaintenanceDeps = { db: Database; databaseUrl: string; storage: ObjectStorage | null; backupsBucket: string | null; log: Logger; now?: () => Date };
  function runMaintenance(deps: MaintenanceDeps): Promise<void>;
  const MAINTENANCE_CRON = "0 3 * * *"; const MAINTENANCE_TZ = "Europe/Moscow";
  ```
- Пароль БД передаётся `pg_dump` через `PGPASSWORD` в окружении дочернего процесса, а не в аргументах (аргументы видны в `ps`) и не пишется в лог.
- Клиент — `postgresql-client-16` из репозитория PGDG: общий сервер БД — `postgres:16`, а `pg_dump` старше сервера отказывается работать.

- [ ] **Step 1: Тесты чистых функций бэкапа**

`apps/worker/src/backup.test.ts`:
```ts
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
```

Run: `pnpm vitest run apps/worker/src/backup.test.ts`
Expected: FAIL — `Cannot find module './backup'`.

- [ ] **Step 2: Реализация бэкапа**

`apps/worker/src/backup.ts`:
```ts
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";

export const BACKUP_PREFIX = "db/";
export const BACKUP_KEEP_DAYS = 14;
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^db\/wishlist-(\d{4}-\d{2}-\d{2})T[\d-]+Z\.sql\.gz$/;
const STDERR_TAIL = 2000;

export function backupKey(now: Date): string {
  return `${BACKUP_PREFIX}wishlist-${now.toISOString().replace(/[:.]/g, "-")}.sql.gz`;
}

export function expiredBackupKeys(keys: string[], now: Date, keepDays = BACKUP_KEEP_DAYS): string[] {
  const cutoff = now.getTime() - keepDays * DAY_MS;
  return keys.filter((key) => {
    const day = KEY_PATTERN.exec(key)?.[1];
    return day !== undefined && new Date(`${day}T00:00:00.000Z`).getTime() < cutoff;
  });
}

export function pgEnvFromUrl(databaseUrl: string): Record<"PGHOST" | "PGPORT" | "PGUSER" | "PGPASSWORD" | "PGDATABASE", string> {
  const url = new URL(databaseUrl);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

export function dumpDatabase(databaseUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("pg_dump", ["--no-owner", "--no-privileges"], {
      env: { ...process.env, ...pgEnvFromUrl(databaseUrl) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const gzip = createGzip();
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    let exitCode: number | null | undefined;
    let compressed = false;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(error);
    };
    // Готово, только когда и pg_dump завершился успешно, и gzip выдал последний блок — порядок этих событий не гарантирован
    const finishIfDone = () => {
      if (settled || exitCode === undefined || !compressed) return;
      settled = true;
      if (exitCode !== 0) reject(new Error(`pg_dump exited with ${exitCode}: ${stderr.trim()}`));
      else resolve(Buffer.concat(chunks));
    };

    child.stdout.pipe(gzip);
    gzip.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BACKUP_BYTES) return fail(new Error(`backup is larger than ${MAX_BACKUP_BYTES} bytes`));
      chunks.push(chunk);
    });
    gzip.on("end", () => {
      compressed = true;
      finishIfDone();
    });
    gzip.on("error", fail);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL);
    });
    child.on("error", fail);
    child.on("close", (code) => {
      exitCode = code;
      finishIfDone();
    });
  });
}
```

Run: `pnpm vitest run apps/worker/src/backup.test.ts`
Expected: PASS.

- [ ] **Step 3: Ночная задача**

`apps/worker/src/maintenance.ts`:
```ts
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
```

В `apps/worker/src/main.ts`:
1. Импорт `import { MAINTENANCE_CRON, MAINTENANCE_TZ, runMaintenance } from "./maintenance";`.
2. Сразу после `if (!storage) log(...)` добавить разовый режим (для ручной проверки на сервере):
```ts
const maintenanceDeps = { db, databaseUrl: env.DATABASE_URL, storage, backupsBucket: env.s3?.backupsBucket ?? null, log };

if (process.argv.includes("--maintenance-once")) {
  await runMaintenance(maintenanceDeps);
  await fetcher.close();
  process.exit(0);
}
```
3. После `await boss.work<ParseItemJob>(...)` добавить:
```ts
await boss.work(QUEUES.maintenance, async () => {
  await runMaintenance(maintenanceDeps);
});
await boss.schedule(QUEUES.maintenance, MAINTENANCE_CRON, {}, { tz: MAINTENANCE_TZ });
```

- [ ] **Step 4: pg_dump в образе воркера**

В `apps/web/Dockerfile` в стадии `worker` сразу после `FROM node:${NODE_VERSION} AS worker` вставить:
```dockerfile
# pg_dump должен быть не старше сервера (postgres:16), в Debian по умолчанию другая версия — берём из PGDG
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && . /etc/os-release \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-16 \
  && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 5: Восстановление — в документацию**

В конец `deploy/server-setup.md` добавить раздел:
````markdown
## 7. Фото, бэкапы и воркер

**S3 (Timeweb, панель → Объектное хранилище):** бакет `wishlist-images` — **публичный** (фото товаров), бакет `wishlist-backups` — **приватный**. Ключи доступа — в `.env`:
```
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_IMAGES_BUCKET=wishlist-images
S3_BACKUPS_BUCKET=wishlist-backups
S3_PUBLIC_BASE_URL=https://s3.twcstorage.ru/wishlist-images
```

**Воркер:** `docker compose up -d worker`, логи — `docker logs --since 30m wishlist-worker-1`.

**Бэкап вручную:** `docker compose run --rm worker node apps/worker/dist/main.mjs --maintenance-once`.
Автоматически — каждый день в 03:00 МСК, хранятся 14 дней.

**Восстановление** (в пустую БД `wishlist`, после остановки web и worker):
```bash
cd /opt/wishlist
docker compose stop web worker
# скачать нужный файл из бакета wishlist-backups через панель Timeweb и положить в /opt/wishlist/restore.sql.gz
gunzip -c restore.sql.gz | docker exec -i food-tracker-bot-db-1 psql -U wishlist -d wishlist -v ON_ERROR_STOP=1
docker compose up -d web worker
```
````

- [ ] **Step 6: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/worker build`
Expected: PASS.

Ручная проверка `--maintenance-once` локально без S3 (терминал 1: `pnpm dev:db`):
```bash
cd apps/worker && node --env-file=../web/.env.development.local dist/main.mjs --maintenance-once
```
Expected: `parse cache pruned` и `backup skipped: S3 is not configured`, процесс завершился с кодом 0. Настоящий `pg_dump` проверяется на сервере (Task 11).

```bash
git add apps/worker apps/web/Dockerfile deploy/server-setup.md
git commit -m "feat(worker): nightly pg_dump backup to S3 and parse cache cleanup"
```

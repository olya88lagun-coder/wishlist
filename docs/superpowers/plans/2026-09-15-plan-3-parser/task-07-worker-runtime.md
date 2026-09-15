# Task 7: Запуск воркера — pg-boss, сборка, Docker, compose, CI

**Files:**
- Create: `apps/worker/src/env.ts`, `apps/worker/src/main.ts`, `apps/worker/scripts/build.mjs`
- Test: `apps/worker/src/env.test.ts`
- Modify: `apps/worker/package.json`, `package.json`, `apps/web/Dockerfile`, `deploy/docker-compose.yml`, `.github/workflows/images.yml`, `packages/db/scripts/dev-db.mjs`, `.env.example`

**Interfaces:**
- Consumes: `QUEUES`, `ParseItemJob` (Task 6, core); `runParseItem`, `createS3Storage`, `log` (Task 6); `createSafeFetcher`, `createHostThrottle`, `parseProduct` (Tasks 3–4); `createDb` (план 1).
- Produces:
  ```ts
  // env.ts
  type WorkerEnv = {
    DATABASE_URL: string;
    s3: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; imagesBucket: string; backupsBucket: string } | null;
  };
  function readWorkerEnv(source?: Record<string, string | undefined>): WorkerEnv;
  // main.ts — точка входа контейнера; флаг --maintenance-once (появится в Task 10)
  ```
- Переменные окружения воркера (тот же `/opt/wishlist/.env`, что у web): `DATABASE_URL`; `S3_ENDPOINT` (по умолчанию `https://s3.twcstorage.ru`), `S3_REGION` (по умолчанию `ru-1`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_IMAGES_BUCKET`, `S3_BACKUPS_BUCKET` — либо все четыре последних, либо ни одного (тогда фото и бэкапы отключены, для локальной разработки).
- Воркер — единственный, кто создаёт схему pg-boss и очереди; web только отправляет задачи (Task 8).

- [x] **Step 1: Окружение (тест → реализация)**

`apps/worker/src/env.test.ts`:
```ts
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
```

Run: `pnpm vitest run apps/worker/src/env.test.ts`
Expected: FAIL — `Cannot find module './env'`.

`apps/worker/src/env.ts`:
```ts
import { z } from "zod";

const S3_REQUIRED = ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_IMAGES_BUCKET", "S3_BACKUPS_BUCKET"] as const;

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url().default("https://s3.twcstorage.ru"),
  S3_REGION: z.string().min(1).default("ru-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_IMAGES_BUCKET: z.string().min(1).optional(),
  S3_BACKUPS_BUCKET: z.string().min(1).optional(),
});

export type WorkerEnv = {
  DATABASE_URL: string;
  s3: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; imagesBucket: string; backupsBucket: string } | null;
};

export function readWorkerEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid environment variables: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  const env = parsed.data;
  const missing = S3_REQUIRED.filter((name) => !env[name]);
  if (missing.length === S3_REQUIRED.length) return { DATABASE_URL: env.DATABASE_URL, s3: null };
  if (missing.length > 0) throw new Error(`Incomplete S3 configuration, missing: ${missing.join(", ")}`);
  return {
    DATABASE_URL: env.DATABASE_URL,
    s3: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      imagesBucket: env.S3_IMAGES_BUCKET!,
      backupsBucket: env.S3_BACKUPS_BUCKET!,
    },
  };
}
```

Run: `pnpm vitest run apps/worker/src/env.test.ts`
Expected: PASS.

- [x] **Step 2: Точка входа**

`apps/worker/src/main.ts`:
```ts
import { type ParseItemJob, QUEUES } from "@wishlist/core";
import { createDb } from "@wishlist/db";
import { createHostThrottle, createSafeFetcher, parseProduct } from "@wishlist/parser";
import { PgBoss } from "pg-boss";
import sharp from "sharp";
import { readWorkerEnv } from "./env";
import { log } from "./log";
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

const boss = new PgBoss({ connectionString: env.DATABASE_URL, max: DB_POOL });
boss.on("error", (error) => log("error", "pg-boss error", { error: String(error) }));

await boss.start();
await boss.createQueue(QUEUES.parseItem);
await boss.createQueue(QUEUES.maintenance);

await boss.work<ParseItemJob>(QUEUES.parseItem, { localConcurrency: PARSE_CONCURRENCY }, async ([job]) => {
  if (!job) return;
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
});

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
```

Если `pnpm typecheck` ругается на сигнатуру `boss.work<ParseItemJob>` или на `boss.stop({ graceful, timeout })` — открыть `node_modules/pg-boss/dist/*.d.ts`, найти фактические типы `work`/`stop` в 12.31.1 и привести вызов к ним, не меняя поведения (конкурентность 2, graceful stop ≤ 20 с).

- [x] **Step 3: Сборка и локальный запуск**

`apps/worker/scripts/build.mjs`:
```js
import { build } from "esbuild";

// Воркер собирается в один ESM-файл: workspace-пакеты экспортируют .ts, а Node не резолвит их импорты без расширений.
// sharp остаётся внешним: у него нативный бинарник, он берётся из node_modules образа.
await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: "dist/main.mjs",
  external: ["sharp", "pg-native"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
```

В `apps/worker/package.json` в `scripts` добавить:
```json
    "build": "node scripts/build.mjs",
    "dev": "node scripts/build.mjs && node --env-file-if-exists=../web/.env.development.local dist/main.mjs"
```

В корневом `package.json` в `scripts` добавить `"dev:worker": "pnpm --filter @wishlist/worker dev"`.

Локальной PGlite-БД теперь нужно больше одного соединения (web, воркер, pg-boss). В `packages/db/scripts/dev-db.mjs` строку создания сервера заменить на:
```js
// web (postgres.js + отправка в pg-boss) и воркер (postgres.js + pg-boss) держат до ~8 соединений; PGlite выполняет запросы по очереди
const server = new PGLiteSocketServer({ db, port: DEV_DB_PORT, host: "127.0.0.1", maxConnections: 10 });
```

Локальный пример `apps/web/.env.development.example` не меняется: без S3 фото и бэкапы отключены. В прод-пример `.env.example` дописать:
```
S3_ACCESS_KEY_ID=from-timeweb-s3-panel
S3_SECRET_ACCESS_KEY=from-timeweb-s3-panel
S3_IMAGES_BUCKET=wishlist-images
S3_BACKUPS_BUCKET=wishlist-backups
S3_PUBLIC_BASE_URL=https://s3.twcstorage.ru/wishlist-images
```

Run: `pnpm --filter @wishlist/worker build`
Expected: `dist/main.mjs` собран, размер — единицы мегабайт, без ошибок резолва.

Ручная проверка (терминал 1: `pnpm dev:db`; терминал 2: `pnpm dev:worker`):
Expected: в выводе `{"level":"warn","message":"S3 is not configured: ..."}` и `{"level":"info","message":"worker started",...}`; процесс не падает. Остановить Ctrl+C → `worker stopping`. Запустить второй раз → снова `worker started` (повторный `createQueue` не ломает старт).

Если pg-boss не стартует на PGlite (ошибка в миграции схемы `pgboss`) — зафиксировать текст ошибки в отчёте задачи; дальнейшая проверка воркера идёт в Docker против настоящего Postgres на шаге 5, а локально web будет работать без парсинга (подарки останутся `pending`, UI через 90 с предложит заполнить вручную — Task 9).

- [x] **Step 4: Образ воркера**

`apps/web/Dockerfile` заменить целиком:
```dockerfile
ARG NODE_VERSION=24-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
RUN corepack enable
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @wishlist/web build

FROM deps AS build-worker
RUN pnpm --filter @wishlist/worker build

# pnpm держит зависимости пакета симлинками в корневой node_modules/.pnpm, поэтому копируются оба каталога
FROM node:${NODE_VERSION} AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/db ./packages/db
USER node
CMD ["node", "packages/db/scripts/migrate.mjs"]

FROM node:${NODE_VERSION} AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build-worker /repo/node_modules ./node_modules
COPY --from=build-worker /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build-worker /repo/apps/worker/dist ./apps/worker/dist
USER node
CMD ["node", "apps/worker/dist/main.mjs"]

FROM node:${NODE_VERSION} AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
```

`.github/workflows/images.yml`: строку `target: [web, migrate]` заменить на `target: [web, migrate, worker]`.

`deploy/docker-compose.yml` — после сервиса `web` добавить:
```yaml
  worker:
    image: ghcr.io/${GHCR_OWNER}/wishlist-worker:latest
    env_file: .env
    restart: unless-stopped
    mem_limit: 200m
    stop_grace_period: 30s
    networks: [shared]
```

- [x] **Step 5: Проверка образа в CI**

Локально Docker нет (план 1), поэтому образ проверяется сборкой в GitHub Actions после мержа (Task 11). Здесь — только статические проверки.

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/worker build && pnpm --filter @wishlist/web build`
Expected: PASS; обе сборки успешны.

- [x] **Step 6: Commit**

```bash
git add apps/worker apps/web/Dockerfile deploy/docker-compose.yml .github/workflows/images.yml packages/db/scripts/dev-db.mjs package.json .env.example pnpm-lock.yaml
git commit -m "feat(worker): pg-boss runtime, esbuild bundle, docker image and compose service"
```

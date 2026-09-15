# Task 6: Воркер — фото в S3 и обработчик задачи парсинга

**Files:**
- Create: `packages/core/src/queues.ts`; Modify: `packages/core/src/index.ts`
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/vitest.config.ts`
- Create: `apps/worker/src/log.ts`, `apps/worker/src/images.ts`, `apps/worker/src/storage.ts`, `apps/worker/src/parse-item.ts`
- Test: `apps/worker/src/images.test.ts`, `apps/worker/src/parse-item.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `parseProduct`, `ParseResult`, `FetchedImage` (Tasks 1–4); `getItemForParsing`, `applyParseResult`, `readParseCache`, `writeParseCache`, `createTestDb`, `createUserFixture`, `createWishlist`, `addItem`, `getOwnerWishlistView`, `Database` (Task 5, планы 1–2).
- Produces:
  ```ts
  // @wishlist/core queues.ts
  const QUEUES: { parseItem: "parse-item"; maintenance: "maintenance" };
  type ParseItemJob = { itemId: string };
  const PARSE_JOB_OPTIONS: { retryLimit: 1; retryDelay: 30; expireInSeconds: 120 };
  // apps/worker
  type Logger = (level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => void;
  const log: Logger;
  const IMAGE_MAX_WIDTH = 800; const IMAGE_MAX_HEIGHT = 1000; const IMAGE_QUALITY = 80; const MAX_INPUT_PIXELS = 40_000_000;
  function toWebp(input: Uint8Array): Promise<Buffer>;
  function itemImageKey(itemId: string, random?: string): string;             // items/<itemId>/<uuid>.webp
  type ObjectStorage = { put(bucket: string, key: string, body: Uint8Array, options: { contentType: string; cacheControl?: string }): Promise<void>; list(bucket: string, prefix: string): Promise<string[]>; remove(bucket: string, keys: string[]): Promise<void> };
  type S3Config = { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string };
  function createS3Storage(config: S3Config): ObjectStorage;
  const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
  type ParseItemDeps = { db: Database; parse(url: string): Promise<ParseResult>; fetchImage(url: string): Promise<FetchedImage>; images: { storage: ObjectStorage; bucket: string } | null; log: Logger };
  function runParseItem(itemId: string, deps: ParseItemDeps): Promise<"applied" | "skipped">;
  ```

- [x] **Step 1: Имена очередей в core**

`packages/core/src/queues.ts`:
```ts
// Общие для web (ставит задачи) и worker (выполняет)
export const QUEUES = { parseItem: "parse-item", maintenance: "maintenance" } as const;

export type ParseItemJob = { itemId: string };

// Одна повторная попытка: если воркер упал посреди задачи, pg-boss вернёт её через 2 минуты
export const PARSE_JOB_OPTIONS = { retryLimit: 1, retryDelay: 30, expireInSeconds: 120 } as const;
```

В `packages/core/src/index.ts` добавить `export * from "./queues";`.

- [x] **Step 2: Каркас приложения**

`apps/worker/package.json`:
```json
{
  "name": "@wishlist/worker",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "3.1131.0",
    "@wishlist/core": "workspace:*",
    "@wishlist/db": "workspace:*",
    "@wishlist/parser": "workspace:*",
    "pg-boss": "12.31.1",
    "sharp": "0.35.4",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "esbuild": "0.28.2"
  }
}
```

`apps/worker/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "scripts"]
}
```

`apps/worker/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "worker", environment: "node", testTimeout: 30000, hookTimeout: 30000 },
});
```

В `.gitignore` добавить строку `dist/`.

Run: `pnpm install`
Expected: зависимости установлены без ошибок `minimumReleaseAge`. Предупреждение pnpm о пропущенных build-скриптах `sharp` допустимо: sharp 0.35 берёт готовые бинарники из `@img/sharp-*`.

- [x] **Step 3: Логгер и хранилище**

`apps/worker/src/log.ts`:
```ts
export type Logger = (level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => void;

// JSON-строки для docker logs; в extra — только id, ссылки на товары и технические причины, без персональных данных
export const log: Logger = (level, message, extra = {}) => {
  const line = JSON.stringify({ at: new Date().toISOString(), level, message, ...extra });
  if (level === "error") console.error(line);
  else console.log(line);
};
```

`apps/worker/src/storage.ts`:
```ts
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export type S3Config = { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string };

export type ObjectStorage = {
  put(bucket: string, key: string, body: Uint8Array, options: { contentType: string; cacheControl?: string }): Promise<void>;
  list(bucket: string, prefix: string): Promise<string[]>;
  remove(bucket: string, keys: string[]): Promise<void>;
};

export function createS3Storage(config: S3Config): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Новые SDK по умолчанию добавляют CRC32-заголовки, которые S3-совместимые хранилища могут отвергать
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    async put(bucket, key, body, options) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: options.contentType, CacheControl: options.cacheControl }));
    },
    async list(bucket, prefix) {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
        for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    async remove(bucket, keys) {
      if (keys.length === 0) return;
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
    },
  };
}
```

- [x] **Step 4: Обработка фото (тест → реализация)**

`apps/worker/src/images.test.ts`:
```ts
import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { IMAGE_MAX_HEIGHT, IMAGE_MAX_WIDTH, itemImageKey, toWebp } from "./images";

const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#d4537e" } }).png().toBuffer();

describe("toWebp", () => {
  test("fits large photos into 800×1000 as webp", async () => {
    const output = await toWebp(await png(2400, 2400));
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(IMAGE_MAX_WIDTH);
    expect(meta.height).toBe(IMAGE_MAX_WIDTH);
  });

  test("keeps small photos at their size", async () => {
    const meta = await sharp(await toWebp(await png(300, 500))).metadata();
    expect([meta.width, meta.height]).toEqual([300, 500]);
  });

  test("tall photos are limited by height", async () => {
    const meta = await sharp(await toWebp(await png(1000, 4000))).metadata();
    expect(meta.height).toBe(IMAGE_MAX_HEIGHT);
  });

  test("rejects bytes that are not an image", async () => {
    await expect(toWebp(new TextEncoder().encode("<html>не картинка</html>"))).rejects.toThrow();
  });
});

test("image keys live under the item id", () => {
  expect(itemImageKey("0b6f6c1e-8a4e-4a57-9d31-6a2c1f2b7e10", "11111111-2222-4333-8444-555555555555")).toBe(
    "items/0b6f6c1e-8a4e-4a57-9d31-6a2c1f2b7e10/11111111-2222-4333-8444-555555555555.webp",
  );
  expect(itemImageKey("a")).toMatch(/^items\/a\/[0-9a-f-]{36}\.webp$/);
});
```

Run: `pnpm vitest run apps/worker/src/images.test.ts`
Expected: FAIL — `Cannot find module './images'`.

`apps/worker/src/images.ts`:
```ts
import { randomUUID } from "node:crypto";
import sharp from "sharp";

export const IMAGE_MAX_WIDTH = 800;
export const IMAGE_MAX_HEIGHT = 1000;
export const IMAGE_QUALITY = 80;
export const MAX_INPUT_PIXELS = 40_000_000;

export async function toWebp(input: Uint8Array): Promise<Buffer> {
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer();
}

export function itemImageKey(itemId: string, random: string = randomUUID()): string {
  return `items/${itemId}/${random}.webp`;
}
```

Run: `pnpm vitest run apps/worker/src/images.test.ts`
Expected: PASS (5 тестов).

- [x] **Step 5: Обработчик задачи (тест)**

`apps/worker/src/parse-item.test.ts`:
```ts
import { addItem, createTestDb, createUserFixture, createWishlist, type Database, getOwnerWishlistView, readParseCache } from "@wishlist/db/testing";
import type { FetchedImage, ParseResult } from "@wishlist/parser";
import sharp from "sharp";
import { beforeEach, describe, expect, test } from "vitest";
import { runParseItem, type ParseItemDeps } from "./parse-item";
import type { ObjectStorage } from "./storage";

const WB = "https://www.wildberries.ru/catalog/173937886/detail.aspx";

const okResult: ParseResult = {
  status: "ok",
  store: "wildberries",
  finalUrl: WB,
  title: "Диффузор для дома",
  description: "Морская соль",
  imageUrl: "https://basket-01.wbbasket.ru/big/1.webp",
  priceKopecks: 289100,
  currency: "RUB",
};

let db: Database;
let owner: string;
let listId: string;
let puts: { bucket: string; key: string; contentType: string; cacheControl?: string }[];
let parseCalls: string[];

function memoryStorage(): ObjectStorage {
  return {
    put: async (bucket, key, _body, options) => void puts.push({ bucket, key, ...options }),
    list: async () => [],
    remove: async () => undefined,
  };
}

async function deps(overrides: Partial<ParseItemDeps> = {}): Promise<ParseItemDeps> {
  const photo = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#ffe66d" } }).png().toBuffer();
  return {
    db,
    parse: async (url) => {
      parseCalls.push(url);
      return okResult;
    },
    fetchImage: async (): Promise<FetchedImage> => ({ ok: true, bytes: photo, contentType: "image/png" }),
    images: { storage: memoryStorage(), bucket: "wishlist-images" },
    log: () => undefined,
    ...overrides,
  };
}

async function linkItem(url = WB) {
  const result = await addItem(db, owner, listId, { title: "", sourceUrl: url, priceKopecks: null, note: null, isMustHave: false });
  if (!result.ok) throw new Error(result.reason);
  return result.itemId;
}

const itemView = async () => (await getOwnerWishlistView(db, owner, listId))?.items[0];

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db);
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
  puts = [];
  parseCalls = [];
});

describe("runParseItem", () => {
  test("parses, stores the photo as immutable webp and fills the item", async () => {
    const id = await linkItem();
    expect(await runParseItem(id, await deps())).toBe("applied");
    expect(puts).toEqual([
      { bucket: "wishlist-images", key: expect.stringMatching(new RegExp(`^items/${id}/[0-9a-f-]{36}\\.webp$`)), contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
    ]);
    expect(await itemView()).toMatchObject({ title: "Диффузор для дома", priceKopecks: 289100, imageKey: puts[0]!.key, parseStatus: "ok" });
    expect(await readParseCache(db, WB)).toMatchObject({ title: "Диффузор для дома", status: "ok" });
  });

  test("uses the 24h cache instead of parsing the same link again", async () => {
    await runParseItem(await linkItem(), await deps());
    await runParseItem(await linkItem(), await deps());
    expect(parseCalls).toEqual([WB]);
  });

  test("skips items that are not pending anymore", async () => {
    const id = await linkItem();
    await runParseItem(id, await deps());
    expect(await runParseItem(id, await deps())).toBe("skipped");
    expect(parseCalls).toHaveLength(1);
  });

  test("a photo that fails to load does not block the text data", async () => {
    const id = await linkItem();
    await runParseItem(id, await deps({ fetchImage: async () => ({ ok: false, reason: "timeout" }) }));
    expect(await itemView()).toMatchObject({ title: "Диффузор для дома", imageKey: null, parseStatus: "ok" });
    expect(puts).toEqual([]);
  });

  test("works without S3 configured (local development)", async () => {
    const id = await linkItem();
    await runParseItem(id, await deps({ images: null }));
    expect(await itemView()).toMatchObject({ imageKey: null, parseStatus: "ok" });
  });

  test("failed parses are not cached and a crashing parser marks the item failed", async () => {
    const id = await linkItem();
    await runParseItem(id, await deps({ parse: async () => { throw new Error("boom"); } }));
    expect(await itemView()).toMatchObject({ parseStatus: "failed", title: "" });
    expect(await readParseCache(db, WB)).toBeNull();
  });
});
```

Экспорт тестовых помощников из `@wishlist/db/testing` — в `packages/db/src/testing.ts` добавить в конец:
```ts
export { createUserFixture } from "./test-fixtures";
export * from "./index";
```

Run: `pnpm vitest run apps/worker/src/parse-item.test.ts`
Expected: FAIL — `Cannot find module './parse-item'`.

- [x] **Step 6: Обработчик задачи (реализация)**

`apps/worker/src/parse-item.ts`:
```ts
import { applyParseResult, type Database, getItemForParsing, readParseCache, writeParseCache } from "@wishlist/db";
import { EMPTY_PRODUCT, type FetchedImage, type ParseResult } from "@wishlist/parser";
import { itemImageKey, toWebp } from "./images";
import type { Logger } from "./log";
import { IMMUTABLE_CACHE_CONTROL, type ObjectStorage } from "./storage";

export type ParseItemDeps = {
  db: Database;
  parse(url: string): Promise<ParseResult>;
  fetchImage(url: string): Promise<FetchedImage>;
  images: { storage: ObjectStorage; bucket: string } | null;
  log: Logger;
};

async function parseWithCache(url: string, deps: ParseItemDeps): Promise<ParseResult> {
  const cached = await readParseCache(deps.db, url);
  if (cached) return cached as ParseResult;
  let result: ParseResult;
  try {
    result = await deps.parse(url);
  } catch (error) {
    deps.log("error", "parser crashed", { url, error: String(error) });
    result = { ...EMPTY_PRODUCT, status: "failed", finalUrl: url, store: "other" };
  }
  if (result.status !== "failed") await writeParseCache(deps.db, url, result);
  return result;
}

async function storeImage(itemId: string, imageUrl: string, deps: ParseItemDeps): Promise<string | null> {
  if (!deps.images) return null;
  try {
    const image = await deps.fetchImage(imageUrl);
    if (!image.ok) {
      deps.log("warn", "image not loaded", { itemId, imageUrl, reason: image.reason });
      return null;
    }
    const key = itemImageKey(itemId);
    await deps.images.storage.put(deps.images.bucket, key, await toWebp(image.bytes), { contentType: "image/webp", cacheControl: IMMUTABLE_CACHE_CONTROL });
    return key;
  } catch (error) {
    deps.log("warn", "image not stored", { itemId, imageUrl, error: String(error) });
    return null;
  }
}

export async function runParseItem(itemId: string, deps: ParseItemDeps): Promise<"applied" | "skipped"> {
  const item = await getItemForParsing(deps.db, itemId);
  if (!item) return "skipped";

  const result = await parseWithCache(item.sourceUrl, deps);
  const imageKey = !item.hasImage && result.imageUrl ? await storeImage(item.id, result.imageUrl, deps) : null;

  const applied = await applyParseResult(deps.db, item.id, item.sourceUrl, {
    normalizedUrl: result.finalUrl,
    store: result.store,
    title: result.title,
    description: result.description,
    priceKopecks: result.priceKopecks,
    imageKey,
  });
  // Пока грузилось фото, владелец мог сменить ссылку или удалить подарок — загруженный файл больше никому не нужен
  if (!applied && imageKey && deps.images) await deps.images.storage.remove(deps.images.bucket, [imageKey]);
  deps.log("info", "item parsed", { itemId, store: result.store, status: result.status, applied, withImage: imageKey !== null });
  return applied ? "applied" : "skipped";
}
```

Run: `pnpm vitest run apps/worker`
Expected: PASS (11 тестов).

- [x] **Step 7: Проверка и commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS, в typecheck есть `apps/worker typecheck: Done`.

```bash
git add packages/core packages/db apps/worker .gitignore pnpm-lock.yaml
git commit -m "feat(worker): parse-item job with webp photos in S3"
```

# Task 6: Инфраструктура веба — формы, гость, rate limit, локальная разработка

**Files:**
- Create: `apps/web/src/server/forms.ts`, `apps/web/src/server/rate-limit.ts`, `apps/web/src/server/viewer.ts`, `apps/web/src/server/dev-login.ts`
- Test: `apps/web/src/server/forms.test.ts`, `apps/web/src/server/rate-limit.test.ts`, `apps/web/src/server/dev-login.test.ts`
- Create: `apps/web/src/app/api/dev/login/route.ts`, `packages/db/scripts/dev-db.mjs`, `apps/web/.env.development.example`
- Modify: `packages/db/src/client.ts`, `packages/db/package.json`, `apps/web/src/server/db.ts`, `package.json` (корень), `.gitignore`

**Interfaces:**
- Consumes: `normalizeProductUrl`, `parseRublesToKopecks`, `Viewer`, `verifySession` (core); `WishlistInput`, `ItemInput`, `WISHLIST_TITLE_MAX`, `ITEM_TITLE_MAX`, `ITEM_NOTE_MAX`, `getUserWithIdentities`, `upsertUserFromIdentity`, `UserWithIdentities` (db); `getEnv`, `getDb`, `SESSION_COOKIE`, `sessionCookieOptions` (web, план 1).
- Produces:
  ```ts
  // forms.ts
  type FieldErrors = Record<string, string>;
  type FormResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };
  function parseWishlistForm(form: FormData): FormResult<WishlistInput>;
  function parseItemForm(form: FormData): FormResult<ItemInput>;
  // rate-limit.ts
  type RateLimiter = { allow(key: string): boolean };
  function createRateLimiter(p: { limit: number; windowMs: number; now?: () => number }): RateLimiter;
  const reservationLimiter: RateLimiter;   // 20 / мин
  const editLimiter: RateLimiter;          // 60 / мин
  // viewer.ts
  const GUEST_COOKIE = "wl_guest";
  function guestCookieOptions(): { httpOnly: true; secure: true; sameSite: "none"; path: "/"; maxAge: number };
  function readViewer(): Promise<{ viewer: Viewer; user: UserWithIdentities | null }>;   // только чтение cookie
  function ensureGuestViewer(): Promise<{ viewer: Viewer; user: UserWithIdentities | null }>; // для Server Action: создаёт wl_guest при отсутствии
  function requireUser(): Promise<UserWithIdentities>;   // redirect("/login") если не вошёл
  function clientKey(viewer: Viewer): Promise<string>;   // userId | guestToken | IP из X-Forwarded-For
  // dev-login.ts
  function isDevLoginEnabled(env: Record<string, string | undefined>): boolean;   // NODE_ENV !== "production" && DEV_LOGIN === "1"
  // db/client.ts (изменение)
  function createDb(databaseUrl: string, options?: { maxConnections?: number }): Database;
  ```

- [x] **Step 1: Падающие тесты форм, лимитера и dev-входа**

`apps/web/src/server/forms.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { parseItemForm, parseWishlistForm } from "./forms";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("parseWishlistForm", () => {
  test("accepts a birthday list with a date", () => {
    expect(parseWishlistForm(form({ title: "  Маше 30 ", occasion: "birthday", eventDate: "2026-03-14" }))).toEqual({
      ok: true,
      value: { title: "Маше 30", occasion: "birthday", eventDate: "2026-03-14" },
    });
  });

  test("treats an empty date as no date", () => {
    expect(parseWishlistForm(form({ title: "Идеи", occasion: "other", eventDate: "" }))).toMatchObject({ ok: true, value: { eventDate: null } });
  });

  test("reports field errors in Russian", () => {
    const result = parseWishlistForm(form({ title: " ", occasion: "wedding", eventDate: "2026-02-30" }));
    expect(result).toEqual({
      ok: false,
      errors: { title: "Введите название списка", occasion: "Выберите повод", eventDate: "Проверьте дату" },
    });
  });

  test("limits title length", () => {
    expect(parseWishlistForm(form({ title: "я".repeat(81), occasion: "other", eventDate: "" }))).toMatchObject({
      ok: false,
      errors: { title: "Название длиннее 80 символов" },
    });
  });
});

describe("parseItemForm", () => {
  test("normalizes the link, parses the price and reads the checkbox", () => {
    expect(
      parseItemForm(form({ title: "Наушники", url: " https://www.wildberries.ru/catalog/1/detail.aspx?utm_source=x ", price: "24 990", note: "чёрные", isMustHave: "on" })),
    ).toEqual({
      ok: true,
      value: { title: "Наушники", sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx", priceKopecks: 2499000, note: "чёрные", isMustHave: true },
    });
  });

  test("optional fields may be empty", () => {
    expect(parseItemForm(form({ title: "Сертификат", url: "", price: "", note: "" }))).toEqual({
      ok: true,
      value: { title: "Сертификат", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false },
    });
  });

  test("reports invalid link, price and missing title", () => {
    expect(parseItemForm(form({ title: "", url: "javascript:alert(1)", price: "дорого", note: "" }))).toEqual({
      ok: false,
      errors: { title: "Введите название подарка", url: "Ссылка должна начинаться с https://", price: "Цена — число в рублях, например 2 490" },
    });
  });
});
```

`apps/web/src/server/rate-limit.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  test("allows up to the limit per key within a window, then resets", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([true, true, false]);
    expect(limiter.allow("b")).toBe(true);
    now = 1000;
    expect(limiter.allow("a")).toBe(true);
  });
});
```

`apps/web/src/server/dev-login.test.ts`:
```ts
import { expect, test } from "vitest";
import { isDevLoginEnabled } from "./dev-login";

test("dev login is only available outside production with an explicit flag", () => {
  expect(isDevLoginEnabled({ NODE_ENV: "development", DEV_LOGIN: "1" })).toBe(true);
  expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(false);
  expect(isDevLoginEnabled({ NODE_ENV: "production", DEV_LOGIN: "1" })).toBe(false);
});
```

Run: `pnpm vitest run apps/web`
Expected: FAIL — `Cannot find module './forms'`, `'./rate-limit'`, `'./dev-login'`.

- [x] **Step 2: Реализация форм**

`apps/web/src/server/forms.ts`:
```ts
import { normalizeProductUrl, parseRublesToKopecks } from "@wishlist/core";
import { ITEM_NOTE_MAX, ITEM_TITLE_MAX, type ItemInput, WISHLIST_TITLE_MAX, type WishlistInput } from "@wishlist/db";
import { z } from "zod";

export type FieldErrors = Record<string, string>;
export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const titleSchema = (max: number, emptyMessage: string, noun: string) =>
  z.string().min(1, emptyMessage).max(max, `${noun} длиннее ${max} символов`);

const wishlistSchema = z.object({
  title: titleSchema(WISHLIST_TITLE_MAX, "Введите название списка", "Название"),
  occasion: z.enum(["birthday", "new_year", "other"], { error: "Выберите повод" }),
  eventDate: z
    .string()
    .refine((v) => v === "" || isRealDate(v), "Проверьте дату")
    .transform((v) => (v === "" ? null : v)),
});

function collectErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    errors[field] ??= issue.message;
  }
  return errors;
}

export function parseWishlistForm(form: FormData): FormResult<WishlistInput> {
  const parsed = wishlistSchema.safeParse({ title: text(form, "title"), occasion: text(form, "occasion"), eventDate: text(form, "eventDate") });
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: collectErrors(parsed.error) };
}

export function parseItemForm(form: FormData): FormResult<ItemInput> {
  const errors: FieldErrors = {};
  const title = titleSchema(ITEM_TITLE_MAX, "Введите название подарка", "Название").safeParse(text(form, "title"));
  if (!title.success) errors.title = title.error.issues[0]!.message;

  const rawUrl = text(form, "url");
  const sourceUrl = rawUrl === "" ? null : normalizeProductUrl(rawUrl);
  if (rawUrl !== "" && sourceUrl === null) errors.url = "Ссылка должна начинаться с https://";

  const rawPrice = text(form, "price");
  const priceKopecks = rawPrice === "" ? null : parseRublesToKopecks(rawPrice);
  if (rawPrice !== "" && priceKopecks === null) errors.price = "Цена — число в рублях, например 2 490";

  const note = text(form, "note");
  if (note.length > ITEM_NOTE_MAX) errors.note = `Заметка длиннее ${ITEM_NOTE_MAX} символов`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { title: title.data!, sourceUrl, priceKopecks, note: note === "" ? null : note, isMustHave: form.get("isMustHave") === "on" },
  };
}
```

Если zod 4 не принимает `{ error: "..." }` в `z.enum` — использовать `z.enum([...], { message: "Выберите повод" })`; проверить по ошибке typecheck.

- [x] **Step 3: Реализация лимитера и dev-входа**

`apps/web/src/server/rate-limit.ts`:
```ts
export type RateLimiter = { allow(key: string): boolean };

const MAX_TRACKED_KEYS = 10_000;
const MINUTE_MS = 60_000;

export function createRateLimiter(p: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = p.now ?? Date.now;
  const windows = new Map<string, { startedAt: number; count: number }>();
  return {
    allow(key) {
      const current = now();
      if (windows.size > MAX_TRACKED_KEYS) windows.clear();
      const window = windows.get(key);
      if (!window || current - window.startedAt >= p.windowMs) {
        windows.set(key, { startedAt: current, count: 1 });
        return true;
      }
      if (window.count >= p.limit) return false;
      windows.set(key, { startedAt: window.startedAt, count: window.count + 1 });
      return true;
    },
  };
}

export const reservationLimiter = createRateLimiter({ limit: 20, windowMs: MINUTE_MS });
export const editLimiter = createRateLimiter({ limit: 60, windowMs: MINUTE_MS });
```

`apps/web/src/server/dev-login.ts`:
```ts
export function isDevLoginEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" && env.DEV_LOGIN === "1";
}
```

- [x] **Step 4: viewer и пул соединений**

`packages/db/src/client.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./types";

const DEFAULT_MAX_CONNECTIONS = 5;

export function createDb(databaseUrl: string, options: { maxConnections?: number } = {}): Database {
  const client = postgres(databaseUrl, { max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS });
  return drizzle(client, { schema }) as unknown as Database;
}
```

`apps/web/src/server/db.ts`:
```ts
import { createDb, type Database } from "@wishlist/db";
import { getEnv } from "./env";

let db: Database | null = null;
export function getDb(): Database {
  // Локальная PGlite-БД обслуживает одно соединение: DATABASE_POOL_MAX=1 в .env.development.local
  const maxConnections = process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined;
  db ??= createDb(getEnv().DATABASE_URL, { maxConnections });
  return db;
}
```

`apps/web/src/server/viewer.ts`:
```ts
import { randomBytes } from "node:crypto";
import type { Viewer } from "@wishlist/core";
import type { UserWithIdentities } from "@wishlist/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth-service";
import { getDb } from "./db";
import { getEnv } from "./env";
import { SESSION_COOKIE } from "./http";

export const GUEST_COOKIE = "wl_guest";
const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function guestCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: GUEST_COOKIE_MAX_AGE_SECONDS } as const;
}

async function currentUser(): Promise<UserWithIdentities | null> {
  const store = await cookies();
  return getCurrentUser({ db: getDb(), env: getEnv() }, store.get(SESSION_COOKIE)?.value ?? null);
}

export async function readViewer(): Promise<{ viewer: Viewer; user: UserWithIdentities | null }> {
  const store = await cookies();
  const raw = store.get(GUEST_COOKIE)?.value ?? null;
  const user = await currentUser();
  return { user, viewer: { userId: user?.id ?? null, guestToken: raw && GUEST_TOKEN_PATTERN.test(raw) ? raw : null } };
}

export async function ensureGuestViewer(): Promise<{ viewer: Viewer; user: UserWithIdentities | null }> {
  const current = await readViewer();
  if (current.viewer.guestToken) return current;
  const guestToken = randomBytes(32).toString("base64url");
  (await cookies()).set(GUEST_COOKIE, guestToken, guestCookieOptions());
  return { user: current.user, viewer: { ...current.viewer, guestToken } };
}

export async function requireUser(): Promise<UserWithIdentities> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function clientKey(viewer: Viewer): Promise<string> {
  if (viewer.userId) return `u:${viewer.userId}`;
  if (viewer.guestToken) return `g:${viewer.guestToken}`;
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded ?? "unknown"}`;
}
```

- [x] **Step 5: Локальная БД и dev-вход**

В `packages/db/package.json` → `devDependencies` добавить `"@electric-sql/pglite-socket": "0.2.11"`.

`packages/db/scripts/dev-db.mjs`:
```js
// Локальная Postgres-совместимая БД для `next dev`: PGlite с данными в .dev-db/ и миграциями
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const DEV_DB_PORT = 5433;
const dataDir = fileURLToPath(new URL("../../../.dev-db", import.meta.url));
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

const db = await PGlite.create(dataDir);
await migrate(drizzle(db), { migrationsFolder });
const server = new PGLiteSocketServer({ db, port: DEV_DB_PORT, host: "127.0.0.1" });
await server.start();
console.log(`dev db ready: postgres://postgres:postgres@127.0.0.1:${DEV_DB_PORT}/postgres`);

process.on("SIGINT", async () => {
  await server.stop();
  await db.close();
  process.exit(0);
});
```

Корневой `package.json` → `scripts` добавить:
```json
"dev:db": "node packages/db/scripts/dev-db.mjs",
"dev:web": "pnpm --filter @wishlist/web dev"
```

`.gitignore` — добавить строку `.dev-db/`.

`apps/web/.env.development.example`:
```
# Скопировать в apps/web/.env.development.local
APP_URL=http://localhost:3000
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable
DATABASE_POOL_MAX=1
SESSION_SECRET=local-dev-secret-local-dev-secret-local
TELEGRAM_BOT_TOKEN=123456:local-dev-token
TELEGRAM_BOT_USERNAME=my_wish_list1_bot
VK_CLIENT_ID=54771492
DEV_LOGIN=1
```

`apps/web/src/app/api/dev/login/route.ts`:
```ts
import { signSession } from "@wishlist/core";
import { upsertUserFromIdentity } from "@wishlist/db";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { isDevLoginEnabled } from "@/server/dev-login";
import { getEnv } from "@/server/env";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

// Только для локальной разработки: Telegram-виджет не работает на localhost
export async function GET(request: NextRequest) {
  if (!isDevLoginEnabled(process.env)) return new NextResponse(null, { status: 404 });
  const name = request.nextUrl.searchParams.get("name") ?? "Разработчик";
  const user = await upsertUserFromIdentity(getDb(), { provider: "telegram", providerUserId: `dev-${name}`, displayName: name, avatarUrl: null });
  const response = NextResponse.redirect(new URL("/lists", getEnv().APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, await signSession(user.id, getEnv().SESSION_SECRET), sessionCookieOptions());
  return response;
}
```

В продакшене `NODE_ENV=production` (задан в Dockerfile), поэтому роут отвечает 404 даже при случайно выставленном `DEV_LOGIN`.

- [x] **Step 6: Тесты и ручная проверка локального запуска**

Run: `pnpm install && pnpm test && pnpm typecheck`
Expected: PASS.

Ручная проверка (два терминала):
```bash
pnpm dev:db
```
Expected: `dev db ready: postgres://postgres:postgres@127.0.0.1:5433/postgres`.
```bash
cp apps/web/.env.development.example apps/web/.env.development.local && pnpm dev:web
```
Открыть `http://localhost:3000/api/health` → `{"ok":true}`; `http://localhost:3000/api/dev/login?name=Маша` → редирект на `/lists` (страница появится в Task 8; до этого 404 — ожидаемо). Остановить оба процесса `Ctrl+C`.

- [x] **Step 7: Commit**

```bash
git add apps/web packages/db package.json .gitignore pnpm-lock.yaml
git commit -m "feat(web): form parsing, guest viewer, rate limits and local dev database"
```

# План 1 — Фундамент: монорепо, база, правила броней, вход Telegram + VK, деплой

> **Статус: выполнен 2026-09-15.** Прод: https://my-wish-list.online (вход Telegram, VK ID, привязка аккаунтов и Mini App проверены вручную).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рабочий каркас продукта: пользователь входит на сайт через Telegram или VK ID (и автоматически в Mini App), видит свою страницу `/me`; схема БД и бизнес-правила броней покрыты тестами; приложение задеплоено на общий VPS за общим Caddy.

**Architecture:** pnpm-монорепо. `packages/core` — чистые функции (правила броней, криптография Telegram, PKCE/VK, сессии) без зависимостей от БД. `packages/db` — Drizzle-схема, миграции и репозитории; тесты на PGlite (Postgres в процессе, Docker не нужен). `apps/web` — Next.js 16 (App Router, standalone): тонкие route handlers поверх тестируемых серверных функций. Образы собираются в GitHub Actions и публикуются в GHCR; на сервере отдельный compose `/opt/wishlist` в сети `food-tracker-bot_default`.

**Tech Stack:** Node 24, pnpm 12, TypeScript 6.0.3, Next.js 16.3, React 19.3, Drizzle ORM 0.45 + drizzle-kit 0.31, postgres (postgres-js) 3.4, @electric-sql/pglite (тесты), jose 6, zod 4, Vitest 5, Docker, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-13-wishlist-mvp-design.md`

## Global Constraints

- **Значения проекта:** `APP_DOMAIN` = `my-wish-list.online` (A-запись на `200.169.178.231` уже настроена, DNS reg.ru); `APP_URL` = `https://my-wish-list.online`; `TELEGRAM_BOT_USERNAME` = `my_wish_list1_bot`; `VK_CLIENT_ID` = `54771492`; `GHCR_OWNER` = `olya88lagun-coder`; git remote = `https://github.com/olya88lagun-coder/wishlist.git`; путь проекта на машине разработчика — `C:\dev\wishlist`. Во всех шагах ниже `APP_DOMAIN` заменяется на `my-wish-list.online`.

- Сервер общий с трекером питания: **никаких изменений** в контейнерах `food-tracker-bot-*` кроме (а) добавления БД/роли `wishlist` в `food-tracker-bot-db-1` и (б) дописывания блока в `/opt/food-tracker-bot/Caddyfile`. Каждая команда на сервере — только после явного «да» пользователя.
- Лимит памяти контейнера `web` — `300m`. Никакого Redis, Playwright, сборки образов на сервере.
- Персональные данные только в РФ (сервер Timeweb Москва).
- API владельца **никогда** не возвращает `guestName`/`guestUserId` его подарков (правило приватности №1 спеки).
- Вход владельца: только Telegram (Mini App `initData`, Login Widget) и VK ID (OAuth 2.1 + PKCE, хост `https://id.vk.ru`).
- Секреты только в `.env` на сервере и в GitHub Secrets; в репозитории — только `.env.example`. Пароли/токены не выводятся в чат и логи.
- Имена пакетов: `@wishlist/core`, `@wishlist/db`, `@wishlist/web`.
- Cookie сессии: `wl_session`, httpOnly, Secure, `SameSite=None` (нужно для Telegram Web, где Mini App в iframe), срок 30 дней. POST-роуты, меняющие состояние, проверяют заголовок `Origin` == `APP_URL`.
- Коммиты — conventional commits (`feat:`, `test:`, `chore:`, `ci:`, `docs:`), без Co-Authored-By.
- Основная ветка репозитория — `master`.

## Предварительные действия пользователя (до Task 1)

Эти шаги делает пользователь сам (создание аккаунтов/токенов запрещено агенту). Агент ждёт подтверждения и **значений без секретов** (домен, username бота, VK client_id, владелец GitHub).

1. **Перенести папку проекта из OneDrive** (например в `C:\dev\wishlist`): OneDrive плохо синхронизирует `node_modules` с симлинками pnpm. После переноса открыть сессию в новой папке.
2. **Домен:** купить/выбрать домен (далее `APP_DOMAIN`, напр. `wishly.ru`), A-запись на `200.169.178.231`.
3. **Telegram-бот:** в @BotFather создать бота → токен сохранить у себя; `/setdomain` → `APP_DOMAIN` (для Login Widget); `/newapp` или Menu Button → URL `https://APP_DOMAIN/tg` (Mini App).
4. **VK ID:** на `https://id.vk.ru/business/go` создать приложение (Web) → `client_id`; доверенный Redirect URL `https://APP_DOMAIN/api/auth/vk/callback`; базовый домен `APP_DOMAIN`.
5. **GitHub:** создать приватный репозиторий `wishlist`, добавить remote, в Settings → Secrets нет нужды на этом этапе (образы пушатся встроенным `GITHUB_TOKEN`). На сервере пользователь сам выполняет `docker login ghcr.io` с PAT (scope `read:packages`).

---

## Карта файлов

```
package.json                     корневые скрипты, packageManager
pnpm-workspace.yaml              packages/*, apps/*
tsconfig.base.json               общие настройки TS
vitest.config.ts                 test.projects
.gitignore  .editorconfig  .env.example  .dockerignore

packages/core/
  package.json  tsconfig.json  vitest.config.ts
  src/index.ts                   реэкспорт
  src/reservations.ts            правила броней и видимости
  src/reservations.test.ts
  src/auth/telegram.ts           verifyTelegramInitData, verifyTelegramLoginWidget
  src/auth/telegram.test.ts
  src/auth/session.ts            signSession, verifySession, signOAuthState, verifyOAuthState
  src/auth/session.test.ts
  src/auth/vk.ts                 createPkcePair, buildVkAuthorizeUrl, exchangeVkCode, fetchVkUser
  src/auth/vk.test.ts

packages/db/
  package.json  tsconfig.json  vitest.config.ts  drizzle.config.ts
  src/index.ts                   реэкспорт
  src/schema.ts                  таблицы и enum'ы
  src/client.ts                  createDb(url) для postgres-js
  src/types.ts                   тип Database
  src/users.ts                   upsertUserFromIdentity, linkIdentity, getUserWithIdentities
  src/users.test.ts
  src/schema.test.ts             ограничения схемы (одна активная бронь)
  src/testing.ts                 createTestDb() на PGlite
  drizzle/                       сгенерированные миграции
  scripts/migrate.mjs            применение миграций в проде

apps/web/
  package.json  tsconfig.json  next.config.ts  vitest.config.ts  Dockerfile
  public/.gitkeep
  src/server/env.ts              zod-валидация env
  src/server/db.ts               singleton db
  src/server/http.ts             sessionCookie(), clearSessionCookie(), isSameOrigin()
  src/server/auth-service.ts     loginWithTelegramInitData, loginWithTelegramWidget, startVkLogin, finishVkLogin, getCurrentUser
  src/server/auth-service.test.ts
  src/app/layout.tsx  src/app/globals.css
  src/app/page.tsx               временная главная → /login
  src/app/login/page.tsx         кнопки Telegram и VK
  src/app/login/TelegramLoginButton.tsx  виджет Telegram Login
  src/app/me/page.tsx            профиль + привязки + выход
  src/app/tg/page.tsx            вход в Mini App
  src/app/tg/TelegramAutoLogin.tsx
  src/app/api/health/route.ts
  src/app/api/auth/telegram/miniapp/route.ts
  src/app/api/auth/telegram/widget/route.ts
  src/app/api/auth/vk/start/route.ts
  src/app/api/auth/vk/callback/route.ts
  src/app/api/auth/logout/route.ts

deploy/
  docker-compose.yml             web + migrate в сети food-tracker-bot_default
  Caddyfile.wishlist             блок для дописывания в Caddyfile трекера
  create-db.sql                  идемпотентное создание роли и БД wishlist
  server-setup.md                пошаговые команды для сервера
.github/workflows/ci.yml         тесты + typecheck на каждый push
.github/workflows/images.yml     сборка и публикация образов на push в master
```

---

### Task 1: Каркас монорепо

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`, `.editorconfig`, `.env.example`, `.dockerignore`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/src/smoke.test.ts`

**Interfaces:**
- Produces: команды `pnpm test`, `pnpm typecheck`; пакет `@wishlist/core` (исходники TS, `exports: "./src/index.ts"`).

- [x] **Step 1: Корневые файлы**

`package.json`:
```json
{
  "name": "wishlist",
  "private": true,
  "packageManager": "pnpm@12.4.1",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm -r --parallel typecheck"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "vitest": "5.0.0",
    "@types/node": "26.5.1"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
  },
});
```

`.gitignore`:
```
node_modules/
.next/
coverage/
.env
.env.*
!.env.example
*.log
```

`.editorconfig`:
```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
```

`.env.example`:
```
APP_URL=https://wishly.ru
DATABASE_URL=postgres://wishlist:CHANGE_ME@db:5432/wishlist
SESSION_SECRET=generate-with-openssl-rand-hex-32
TELEGRAM_BOT_TOKEN=123456:ABC
TELEGRAM_BOT_USERNAME=wishly_bot
VK_CLIENT_ID=12345678
GHCR_OWNER=your-github-login
```

`.dockerignore`:
```
node_modules
**/node_modules
.next
**/.next
.git
.env
docs
coverage
```

- [x] **Step 2: Пакет core**

`packages/core/package.json`:
```json
{
  "name": "@wishlist/core",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc -p tsconfig.json" },
  "dependencies": { "jose": "6.2.12" }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"]
}
```

`packages/core/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "core", environment: "node" },
});
```

`packages/core/src/index.ts`:
```ts
export {};
```

`packages/core/src/smoke.test.ts`:
```ts
import { expect, test } from "vitest";

test("test runner works", () => {
  expect(1 + 1).toBe(2);
});
```

- [x] **Step 3: Установить и прогнать**

Run: `pnpm install && pnpm test && pnpm typecheck`
Expected: `1 passed`, typecheck без ошибок.

- [x] **Step 4: Удалить smoke-тест и закоммитить**

Удалить `packages/core/src/smoke.test.ts` (его заменят реальные тесты в Task 2).

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with core package"
```

---

### Task 2: Правила броней и видимости (`packages/core`)

**Files:**
- Create: `packages/core/src/reservations.ts`
- Test: `packages/core/src/reservations.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  type Viewer = { userId: string | null; guestToken: string | null };
  type ActiveReservation = { guestUserId: string | null; guestToken: string | null; guestName: string };
  type ItemReservationState = { ownerId: string; active: ActiveReservation | null };
  type ReserveDecision = { ok: true; guestName: string } | { ok: false; reason: "OWNER_CANNOT_RESERVE" | "ALREADY_RESERVED" | "NO_IDENTITY" | "INVALID_NAME" };
  function decideReserve(state: ItemReservationState, viewer: Viewer, rawGuestName: string): ReserveDecision;
  function decideCancel(state: ItemReservationState, viewer: Viewer): { ok: true } | { ok: false; reason: "NOT_RESERVED" | "NOT_YOUR_RESERVATION" };
  function ownerReservationView(state: ItemReservationState, surpriseMode: boolean): { reserved: boolean };
  function guestReservationView(state: ItemReservationState, viewer: Viewer): { status: "free" | "reserved_by_me" | "reserved_by_other" };
  const GUEST_NAME_MAX_LENGTH = 40;
  ```

- [x] **Step 1: Написать падающие тесты**

`packages/core/src/reservations.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  decideCancel,
  decideReserve,
  guestReservationView,
  ownerReservationView,
  type ItemReservationState,
  type Viewer,
} from "./reservations";

const OWNER = "owner-1";
const free: ItemReservationState = { ownerId: OWNER, active: null };
const reservedByAnon: ItemReservationState = {
  ownerId: OWNER,
  active: { guestUserId: null, guestToken: "tok-anna", guestName: "Аня" },
};
const reservedByUser: ItemReservationState = {
  ownerId: OWNER,
  active: { guestUserId: "user-2", guestToken: null, guestName: "Оля" },
};
const anon = (token: string): Viewer => ({ userId: null, guestToken: token });
const user = (id: string): Viewer => ({ userId: id, guestToken: null });

describe("decideReserve", () => {
  test("allows a guest to reserve a free item and trims the name", () => {
    expect(decideReserve(free, anon("tok-anna"), "  Аня ")).toEqual({ ok: true, guestName: "Аня" });
  });

  test("rejects the owner reserving their own item", () => {
    expect(decideReserve(free, user(OWNER), "Маша")).toEqual({ ok: false, reason: "OWNER_CANNOT_RESERVE" });
  });

  test("rejects when the item already has an active reservation", () => {
    expect(decideReserve(reservedByAnon, anon("tok-other"), "Петя")).toEqual({ ok: false, reason: "ALREADY_RESERVED" });
  });

  test("rejects a viewer without user id and guest token", () => {
    expect(decideReserve(free, { userId: null, guestToken: null }, "Аня")).toEqual({ ok: false, reason: "NO_IDENTITY" });
  });

  test("rejects an empty or too long name", () => {
    expect(decideReserve(free, anon("t"), "   ")).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(decideReserve(free, anon("t"), "я".repeat(41))).toEqual({ ok: false, reason: "INVALID_NAME" });
  });
});

describe("decideCancel", () => {
  test("lets the anonymous guest who reserved cancel by token", () => {
    expect(decideCancel(reservedByAnon, anon("tok-anna"))).toEqual({ ok: true });
  });

  test("lets the logged-in guest who reserved cancel", () => {
    expect(decideCancel(reservedByUser, user("user-2"))).toEqual({ ok: true });
  });

  test("rejects someone else cancelling", () => {
    expect(decideCancel(reservedByAnon, anon("tok-other"))).toEqual({ ok: false, reason: "NOT_YOUR_RESERVATION" });
    expect(decideCancel(reservedByUser, user(OWNER))).toEqual({ ok: false, reason: "NOT_YOUR_RESERVATION" });
  });

  test("rejects cancelling a free item", () => {
    expect(decideCancel(free, anon("tok-anna"))).toEqual({ ok: false, reason: "NOT_RESERVED" });
  });
});

describe("ownerReservationView", () => {
  test("shows only a reserved flag, never guest details", () => {
    const view = ownerReservationView(reservedByAnon, false);
    expect(view).toEqual({ reserved: true });
    expect(JSON.stringify(view)).not.toContain("Аня");
  });

  test("hides even the reserved flag in surprise mode", () => {
    expect(ownerReservationView(reservedByAnon, true)).toEqual({ reserved: false });
  });

  test("reports free items as not reserved", () => {
    expect(ownerReservationView(free, false)).toEqual({ reserved: false });
  });
});

describe("guestReservationView", () => {
  test("distinguishes free, mine and someone else's", () => {
    expect(guestReservationView(free, anon("tok-anna"))).toEqual({ status: "free" });
    expect(guestReservationView(reservedByAnon, anon("tok-anna"))).toEqual({ status: "reserved_by_me" });
    expect(guestReservationView(reservedByAnon, anon("tok-other"))).toEqual({ status: "reserved_by_other" });
    expect(guestReservationView(reservedByUser, user("user-2"))).toEqual({ status: "reserved_by_me" });
  });
});
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `pnpm vitest run packages/core/src/reservations.test.ts`
Expected: FAIL — `Failed to resolve import "./reservations"`.

- [x] **Step 3: Реализация**

`packages/core/src/reservations.ts`:
```ts
export const GUEST_NAME_MAX_LENGTH = 40;

export type Viewer = { userId: string | null; guestToken: string | null };

export type ActiveReservation = {
  guestUserId: string | null;
  guestToken: string | null;
  guestName: string;
};

export type ItemReservationState = { ownerId: string; active: ActiveReservation | null };

export type ReserveDecision =
  | { ok: true; guestName: string }
  | { ok: false; reason: "OWNER_CANNOT_RESERVE" | "ALREADY_RESERVED" | "NO_IDENTITY" | "INVALID_NAME" };

export type CancelDecision = { ok: true } | { ok: false; reason: "NOT_RESERVED" | "NOT_YOUR_RESERVATION" };

function isReservedBy(active: ActiveReservation, viewer: Viewer): boolean {
  if (viewer.userId !== null && active.guestUserId === viewer.userId) return true;
  return viewer.guestToken !== null && active.guestToken === viewer.guestToken;
}

export function decideReserve(state: ItemReservationState, viewer: Viewer, rawGuestName: string): ReserveDecision {
  if (viewer.userId === null && viewer.guestToken === null) return { ok: false, reason: "NO_IDENTITY" };
  if (viewer.userId === state.ownerId) return { ok: false, reason: "OWNER_CANNOT_RESERVE" };
  if (state.active !== null) return { ok: false, reason: "ALREADY_RESERVED" };
  const guestName = rawGuestName.trim();
  if (guestName.length === 0 || guestName.length > GUEST_NAME_MAX_LENGTH) {
    return { ok: false, reason: "INVALID_NAME" };
  }
  return { ok: true, guestName };
}

export function decideCancel(state: ItemReservationState, viewer: Viewer): CancelDecision {
  if (state.active === null) return { ok: false, reason: "NOT_RESERVED" };
  if (!isReservedBy(state.active, viewer)) return { ok: false, reason: "NOT_YOUR_RESERVATION" };
  return { ok: true };
}

export function ownerReservationView(state: ItemReservationState, surpriseMode: boolean): { reserved: boolean } {
  return { reserved: !surpriseMode && state.active !== null };
}

export function guestReservationView(
  state: ItemReservationState,
  viewer: Viewer,
): { status: "free" | "reserved_by_me" | "reserved_by_other" } {
  if (state.active === null) return { status: "free" };
  return { status: isReservedBy(state.active, viewer) ? "reserved_by_me" : "reserved_by_other" };
}
```

`packages/core/src/index.ts`:
```ts
export * from "./reservations";
```

- [x] **Step 4: Тесты проходят**

Run: `pnpm vitest run packages/core && pnpm typecheck`
Expected: PASS (13 тестов), typecheck без ошибок.

- [x] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): reservation and visibility rules"
```

---

### Task 3: Проверка подписи Telegram и сессии (`packages/core/auth`)

**Files:**
- Create: `packages/core/src/auth/telegram.ts`, `packages/core/src/auth/session.ts`
- Test: `packages/core/src/auth/telegram.test.ts`, `packages/core/src/auth/session.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  type TelegramUser = { id: number; firstName: string; lastName: string | null; username: string | null; photoUrl: string | null };
  type TelegramVerifyResult = { ok: true; user: TelegramUser } | { ok: false; reason: "MISSING_HASH" | "BAD_HASH" | "EXPIRED" | "MALFORMED" };
  function verifyTelegramInitData(initData: string, botToken: string, now: Date, maxAgeSeconds?: number): TelegramVerifyResult;
  function verifyTelegramLoginWidget(params: URLSearchParams, botToken: string, now: Date, maxAgeSeconds?: number): TelegramVerifyResult;
  const TELEGRAM_AUTH_MAX_AGE_SECONDS = 86400;
  function signSession(userId: string, secret: string): Promise<string>;
  function verifySession(token: string, secret: string): Promise<string | null>;
  function signOAuthState(payload: { state: string; codeVerifier: string; linkUserId: string | null }, secret: string): Promise<string>;
  function verifyOAuthState(token: string, secret: string): Promise<{ state: string; codeVerifier: string; linkUserId: string | null } | null>;
  const SESSION_TTL_SECONDS = 2592000;
  const OAUTH_STATE_TTL_SECONDS = 600;
  ```

- [x] **Step 1: Падающие тесты Telegram**

`packages/core/src/auth/telegram.test.ts`:
```ts
import { createHash, createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifyTelegramInitData, verifyTelegramLoginWidget } from "./telegram";

const BOT_TOKEN = "123456:TEST-TOKEN";
const NOW = new Date("2026-09-14T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function dataCheckString(fields: Record<string, string>): string {
  return Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
}

function signInitData(fields: Record<string, string>): string {
  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString(fields)).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

function signWidget(fields: Record<string, string>): URLSearchParams {
  const secret = createHash("sha256").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString(fields)).digest("hex");
  return new URLSearchParams({ ...fields, hash });
}

const tgUserJson = JSON.stringify({ id: 42, first_name: "Маша", last_name: "Иванова", username: "masha", photo_url: "https://t.me/i/u.jpg" });

describe("verifyTelegramInitData", () => {
  test("accepts correctly signed fresh init data", () => {
    const initData = signInitData({ auth_date: String(nowSec - 60), query_id: "q1", user: tgUserJson });
    expect(verifyTelegramInitData(initData, BOT_TOKEN, NOW)).toEqual({
      ok: true,
      user: { id: 42, firstName: "Маша", lastName: "Иванова", username: "masha", photoUrl: "https://t.me/i/u.jpg" },
    });
  });

  test("rejects tampered data", () => {
    const initData = signInitData({ auth_date: String(nowSec), user: tgUserJson }).replace("masha", "hacker");
    expect(verifyTelegramInitData(initData, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects data signed for another bot", () => {
    const initData = signInitData({ auth_date: String(nowSec), user: tgUserJson });
    expect(verifyTelegramInitData(initData, "999:OTHER", NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects stale data", () => {
    const initData = signInitData({ auth_date: String(nowSec - 86401), user: tgUserJson });
    expect(verifyTelegramInitData(initData, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  test("rejects missing hash and missing user", () => {
    expect(verifyTelegramInitData("auth_date=1", BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "MISSING_HASH" });
    const noUser = signInitData({ auth_date: String(nowSec) });
    expect(verifyTelegramInitData(noUser, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "MALFORMED" });
  });
});

describe("verifyTelegramLoginWidget", () => {
  test("accepts correctly signed widget params", () => {
    const params = signWidget({ id: "42", first_name: "Маша", username: "masha", auth_date: String(nowSec) });
    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({
      ok: true,
      user: { id: 42, firstName: "Маша", lastName: null, username: "masha", photoUrl: null },
    });
  });

  test("rejects init-data style signature used for the widget", () => {
    const initDataSigned = new URLSearchParams(signInitData({ id: "42", first_name: "Маша", auth_date: String(nowSec) }));
    expect(verifyTelegramLoginWidget(initDataSigned, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "BAD_HASH" });
  });

  test("rejects stale widget params", () => {
    const params = signWidget({ id: "42", first_name: "Маша", auth_date: String(nowSec - 90000) });
    expect(verifyTelegramLoginWidget(params, BOT_TOKEN, NOW)).toEqual({ ok: false, reason: "EXPIRED" });
  });
});
```

- [x] **Step 2: Падающие тесты сессий**

`packages/core/src/auth/session.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { signOAuthState, signSession, verifyOAuthState, verifySession } from "./session";

const SECRET = "a".repeat(64);

describe("session tokens", () => {
  test("round-trips a user id", async () => {
    const token = await signSession("user-1", SECRET);
    expect(await verifySession(token, SECRET)).toBe("user-1");
  });

  test("returns null for a token signed with another secret", async () => {
    const token = await signSession("user-1", "b".repeat(64));
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  test("returns null for garbage", async () => {
    expect(await verifySession("not-a-jwt", SECRET)).toBeNull();
  });

  test("does not accept an oauth state token as a session", async () => {
    const stateToken = await signOAuthState({ state: "s", codeVerifier: "v", linkUserId: null }, SECRET);
    expect(await verifySession(stateToken, SECRET)).toBeNull();
  });
});

describe("oauth state tokens", () => {
  test("round-trips the payload", async () => {
    const payload = { state: "st-1", codeVerifier: "ver-1", linkUserId: "user-9" };
    const token = await signOAuthState(payload, SECRET);
    expect(await verifyOAuthState(token, SECRET)).toEqual(payload);
  });

  test("does not accept a session token as oauth state", async () => {
    const token = await signSession("user-1", SECRET);
    expect(await verifyOAuthState(token, SECRET)).toBeNull();
  });
});
```

- [x] **Step 3: Тесты падают**

Run: `pnpm vitest run packages/core/src/auth`
Expected: FAIL — `Failed to resolve import "./telegram"` и `"./session"`.

- [x] **Step 4: Реализация Telegram**

`packages/core/src/auth/telegram.ts`:
```ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 86400;

export type TelegramUser = {
  id: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
};

export type TelegramVerifyResult =
  | { ok: true; user: TelegramUser }
  | { ok: false; reason: "MISSING_HASH" | "BAD_HASH" | "EXPIRED" | "MALFORMED" };

type Checked = { ok: true; fields: Map<string, string> } | { ok: false; reason: "MISSING_HASH" | "BAD_HASH" | "EXPIRED" };

function checkSignature(params: URLSearchParams, secretKey: Buffer, now: Date, maxAgeSeconds: number): Checked {
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "MISSING_HASH" };
  const fields = new Map<string, string>();
  for (const [key, value] of params) if (key !== "hash") fields.set(key, value);
  const dataCheckString = [...fields.keys()].sort().map((k) => `${k}=${fields.get(k)}`).join("\n");
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, reason: "BAD_HASH" };
  const authDate = Number(fields.get("auth_date"));
  const ageSeconds = Math.floor(now.getTime() / 1000) - authDate;
  if (!Number.isFinite(authDate) || ageSeconds > maxAgeSeconds) return { ok: false, reason: "EXPIRED" };
  return { ok: true, fields };
}

function toUser(raw: { id?: unknown; first_name?: unknown; last_name?: unknown; username?: unknown; photo_url?: unknown }): TelegramUser | null {
  const id = Number(raw.id);
  if (!Number.isSafeInteger(id) || typeof raw.first_name !== "string") return null;
  const optional = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  return { id, firstName: raw.first_name, lastName: optional(raw.last_name), username: optional(raw.username), photoUrl: optional(raw.photo_url) };
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  now: Date,
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS,
): TelegramVerifyResult {
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const checked = checkSignature(new URLSearchParams(initData), secretKey, now, maxAgeSeconds);
  if (!checked.ok) return checked;
  const userJson = checked.fields.get("user");
  if (!userJson) return { ok: false, reason: "MALFORMED" };
  try {
    const user = toUser(JSON.parse(userJson));
    return user ? { ok: true, user } : { ok: false, reason: "MALFORMED" };
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
}

export function verifyTelegramLoginWidget(
  params: URLSearchParams,
  botToken: string,
  now: Date,
  maxAgeSeconds = TELEGRAM_AUTH_MAX_AGE_SECONDS,
): TelegramVerifyResult {
  const secretKey = createHash("sha256").update(botToken).digest();
  const checked = checkSignature(params, secretKey, now, maxAgeSeconds);
  if (!checked.ok) return checked;
  const user = toUser(Object.fromEntries(checked.fields));
  return user ? { ok: true, user } : { ok: false, reason: "MALFORMED" };
}
```

- [x] **Step 5: Реализация сессий**

`packages/core/src/auth/session.ts`:
```ts
import { jwtVerify, SignJWT } from "jose";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const OAUTH_STATE_TTL_SECONDS = 600;

const SESSION_AUDIENCE = "session";
const OAUTH_AUDIENCE = "oauth-state";

export type OAuthStatePayload = { state: string; codeVerifier: string; linkUserId: string | null };

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySession(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { audience: SESSION_AUDIENCE, algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function signOAuthState(payload: OAuthStatePayload, secret: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(OAUTH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_STATE_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function verifyOAuthState(token: string, secret: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { audience: OAUTH_AUDIENCE, algorithms: ["HS256"] });
    const { state, codeVerifier, linkUserId } = payload;
    if (typeof state !== "string" || typeof codeVerifier !== "string") return null;
    return { state, codeVerifier, linkUserId: typeof linkUserId === "string" ? linkUserId : null };
  } catch {
    return null;
  }
}
```

`packages/core/src/index.ts`:
```ts
export * from "./reservations";
export * from "./auth/telegram";
export * from "./auth/session";
```

- [x] **Step 6: Тесты проходят**

Run: `pnpm install && pnpm vitest run packages/core && pnpm typecheck`
Expected: PASS (все тесты core), typecheck чистый.

- [x] **Step 7: Commit**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): telegram signature verification and session tokens"
```

---

### Task 4: VK ID OAuth 2.1 + PKCE (`packages/core/auth/vk`)

**Files:**
- Create: `packages/core/src/auth/vk.ts`
- Test: `packages/core/src/auth/vk.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: ничего.
- Produces:
  ```ts
  const VK_ID_HOST = "https://id.vk.ru";
  type FetchFn = (input: string, init: RequestInit) => Promise<Response>;
  type VkUser = { id: string; firstName: string; lastName: string | null; avatarUrl: string | null };
  function createPkcePair(): { codeVerifier: string; codeChallenge: string };
  function buildVkAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string;
  function exchangeVkCode(p: { clientId: string; redirectUri: string; code: string; codeVerifier: string; deviceId: string; state: string; fetchFn: FetchFn }): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }>;
  function fetchVkUser(p: { clientId: string; accessToken: string; fetchFn: FetchFn }): Promise<{ ok: true; user: VkUser } | { ok: false; error: string }>;
  ```

- [x] **Step 1: Падающие тесты**

`packages/core/src/auth/vk.test.ts`:
```ts
import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { buildVkAuthorizeUrl, createPkcePair, exchangeVkCode, fetchVkUser } from "./vk";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createPkcePair", () => {
  test("challenge is base64url(sha256(verifier)) and verifier is 43+ url-safe chars", () => {
    const { codeVerifier, codeChallenge } = createPkcePair();
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(codeChallenge).toBe(createHash("sha256").update(codeVerifier).digest("base64url"));
  });

  test("generates a different verifier each time", () => {
    expect(createPkcePair().codeVerifier).not.toBe(createPkcePair().codeVerifier);
  });
});

describe("buildVkAuthorizeUrl", () => {
  test("contains all OAuth 2.1 PKCE parameters", () => {
    const url = new URL(
      buildVkAuthorizeUrl({ clientId: "123", redirectUri: "https://wishly.ru/api/auth/vk/callback", state: "st", codeChallenge: "ch" }),
    );
    expect(url.origin + url.pathname).toBe("https://id.vk.ru/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "123",
      redirect_uri: "https://wishly.ru/api/auth/vk/callback",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
      scope: "vkid.personal_info",
    });
  });
});

describe("exchangeVkCode", () => {
  test("posts form data to the token endpoint and returns the access token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "at-1", user_id: 777 }));
    const result = await exchangeVkCode({
      clientId: "123", redirectUri: "https://wishly.ru/cb", code: "c1", codeVerifier: "v1", deviceId: "d1", state: "st", fetchFn,
    });
    expect(result).toEqual({ ok: true, accessToken: "at-1" });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://id.vk.ru/oauth2/auth");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      grant_type: "authorization_code", code: "c1", code_verifier: "v1", client_id: "123", device_id: "d1", redirect_uri: "https://wishly.ru/cb", state: "st",
    });
  });

  test("returns the provider error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant", error_description: "code expired" }, 400));
    const result = await exchangeVkCode({ clientId: "1", redirectUri: "r", code: "c", codeVerifier: "v", deviceId: "d", state: "s", fetchFn });
    expect(result).toEqual({ ok: false, error: "invalid_grant" });
  });
});

describe("fetchVkUser", () => {
  test("maps the user_info response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ user: { user_id: "777", first_name: "Маша", last_name: "Иванова", avatar: "https://vk.ru/a.jpg" } }),
    );
    expect(await fetchVkUser({ clientId: "123", accessToken: "at-1", fetchFn })).toEqual({
      ok: true,
      user: { id: "777", firstName: "Маша", lastName: "Иванова", avatarUrl: "https://vk.ru/a.jpg" },
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://id.vk.ru/oauth2/user_info");
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({ access_token: "at-1", client_id: "123" });
  });

  test("fails on a malformed response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ user: {} }));
    expect(await fetchVkUser({ clientId: "1", accessToken: "a", fetchFn })).toEqual({ ok: false, error: "malformed_user_info" });
  });
});
```

- [x] **Step 2: Тесты падают**

Run: `pnpm vitest run packages/core/src/auth/vk.test.ts`
Expected: FAIL — `Failed to resolve import "./vk"`.

- [x] **Step 3: Реализация**

`packages/core/src/auth/vk.ts`:
```ts
import { createHash, randomBytes } from "node:crypto";

export const VK_ID_HOST = "https://id.vk.ru";
const VK_SCOPE = "vkid.personal_info";
const FORM_HEADERS = { "content-type": "application/x-www-form-urlencoded" };

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;
export type VkUser = { id: string; firstName: string; lastName: string | null; avatarUrl: string | null };

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildVkAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string {
  const url = new URL("/authorize", VK_ID_HOST);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    scope: VK_SCOPE,
  }).toString();
  return url.toString();
}

async function postForm(fetchFn: FetchFn, path: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetchFn(`${VK_ID_HOST}${path}`, {
    method: "POST",
    headers: FORM_HEADERS,
    body: new URLSearchParams(form).toString(),
  });
  return (await response.json()) as Record<string, unknown>;
}

export async function exchangeVkCode(p: {
  clientId: string; redirectUri: string; code: string; codeVerifier: string; deviceId: string; state: string; fetchFn: FetchFn;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const body = await postForm(p.fetchFn, "/oauth2/auth", {
    grant_type: "authorization_code",
    code: p.code,
    code_verifier: p.codeVerifier,
    client_id: p.clientId,
    device_id: p.deviceId,
    redirect_uri: p.redirectUri,
    state: p.state,
  });
  if (typeof body.access_token === "string") return { ok: true, accessToken: body.access_token };
  return { ok: false, error: typeof body.error === "string" ? body.error : "token_exchange_failed" };
}

export async function fetchVkUser(p: {
  clientId: string; accessToken: string; fetchFn: FetchFn;
}): Promise<{ ok: true; user: VkUser } | { ok: false; error: string }> {
  const body = await postForm(p.fetchFn, "/oauth2/user_info", { access_token: p.accessToken, client_id: p.clientId });
  const user = body.user as Record<string, unknown> | undefined;
  const id = user?.user_id;
  if (!user || (typeof id !== "string" && typeof id !== "number") || typeof user.first_name !== "string") {
    return { ok: false, error: "malformed_user_info" };
  }
  const optional = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  return {
    ok: true,
    user: { id: String(id), firstName: user.first_name, lastName: optional(user.last_name), avatarUrl: optional(user.avatar) },
  };
}
```

`packages/core/src/index.ts`:
```ts
export * from "./reservations";
export * from "./auth/telegram";
export * from "./auth/session";
export * from "./auth/vk";
```

- [x] **Step 4: Тесты проходят**

Run: `pnpm vitest run packages/core && pnpm typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): VK ID OAuth 2.1 PKCE helpers"
```

---

### Task 5: Схема БД и миграции (`packages/db`)

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/vitest.config.ts`, `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema.ts`, `packages/db/src/types.ts`, `packages/db/src/client.ts`, `packages/db/src/testing.ts`, `packages/db/src/index.ts`
- Create: `packages/db/drizzle/*` (генерируется), `packages/db/scripts/migrate.mjs`
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // schema.ts
  users, authIdentities, wishlists, items, reservations  // таблицы Drizzle
  authProviderEnum ("telegram" | "vk"), occasionEnum, parseStatusEnum, reservationStatusEnum
  type AuthProvider = "telegram" | "vk";
  // types.ts
  type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
  // client.ts
  function createDb(databaseUrl: string): Database;
  // testing.ts
  function createTestDb(): Promise<Database>;   // PGlite + все миграции
  ```

- [x] **Step 1: Пакет и конфиги**

`packages/db/package.json`:
```json
{
  "name": "@wishlist/db",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "drizzle-orm": "0.45.2",
    "postgres": "3.4.9"
  },
  "devDependencies": {
    "drizzle-kit": "0.31.10",
    "@electric-sql/pglite": "latest"
  }
}
```
После `pnpm install` зафиксировать фактическую версию PGlite: заменить `latest` на версию из `pnpm-lock.yaml`.

`packages/db/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "drizzle.config.ts"]
}
```

`packages/db/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "db", environment: "node", testTimeout: 30000 },
});
```

`packages/db/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
```

- [x] **Step 2: Схема**

`packages/db/src/schema.ts`:
```ts
import { sql } from "drizzle-orm";
import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const authProviderEnum = pgEnum("auth_provider", ["telegram", "vk"]);
export const occasionEnum = pgEnum("occasion", ["birthday", "new_year", "other"]);
export const parseStatusEnum = pgEnum("parse_status", ["pending", "ok", "partial", "failed"]);
export const reservationStatusEnum = pgEnum("reservation_status", ["active", "cancelled"]);

export type AuthProvider = (typeof authProviderEnum.enumValues)[number];

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  surpriseMode: boolean("surprise_mode").notNull().default(false),
  createdAt: createdAt(),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("auth_identities_provider_user_uq").on(t.provider, t.providerUserId),
    uniqueIndex("auth_identities_user_provider_uq").on(t.userId, t.provider),
  ],
);

export const wishlists = pgTable(
  "wishlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    occasion: occasionEnum("occasion").notNull().default("birthday"),
    eventDate: date("event_date", { mode: "string" }),
    slug: text("slug").notNull().unique(),
    themeId: text("theme_id").notNull().default("journal"),
    createdAt: createdAt(),
  },
  (t) => [index("wishlists_owner_idx").on(t.ownerId)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wishlistId: uuid("wishlist_id").notNull().references(() => wishlists.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url"),
    normalizedUrl: text("normalized_url"),
    store: text("store"),
    title: text("title").notNull().default(""),
    description: text("description"),
    imageKey: text("image_key"),
    priceKopecks: integer("price_kopecks"),
    currency: text("currency").notNull().default("RUB"),
    parseStatus: parseStatusEnum("parse_status").notNull().default("pending"),
    note: text("note"),
    isMustHave: boolean("is_must_have").notNull().default(false),
    position: integer("position").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("items_wishlist_idx").on(t.wishlistId)],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    guestUserId: uuid("guest_user_id").references(() => users.id, { onDelete: "set null" }),
    guestToken: text("guest_token"),
    guestName: text("guest_name").notNull(),
    cancelToken: text("cancel_token").notNull().unique(),
    status: reservationStatusEnum("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reservations_one_active_per_item_uq").on(t.itemId).where(sql`"status" = 'active'`)],
);
```

`packages/db/src/types.ts`:
```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
```

`packages/db/src/client.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./types";

const MAX_CONNECTIONS = 5;

export function createDb(databaseUrl: string): Database {
  const client = postgres(databaseUrl, { max: MAX_CONNECTIONS });
  return drizzle(client, { schema }) as unknown as Database;
}
```

`packages/db/src/testing.ts`:
```ts
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Database } from "./types";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export async function createTestDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as Database;
}
```

`packages/db/src/index.ts`:
```ts
export * as schema from "./schema";
export * from "./schema";
export type { Database } from "./types";
export { createDb } from "./client";
```

- [x] **Step 3: Сгенерировать миграцию**

Run: `pnpm install && pnpm --filter @wishlist/db db:generate`
Expected: в `packages/db/drizzle/` появилась папка миграции с `migration.sql`, содержащим `CREATE UNIQUE INDEX "reservations_one_active_per_item_uq" ... WHERE "status" = 'active'`. Если `WHERE` отсутствует — остановиться и сообщить (не править SQL вручную без согласования).

- [x] **Step 4: Написать тест ограничений схемы**

`packages/db/src/schema.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import { authIdentities, items, reservations, users, wishlists } from "./schema";
import { createTestDb } from "./testing";
import type { Database } from "./types";

let db: Database;
let itemId: string;

beforeEach(async () => {
  db = await createTestDb();
  const [owner] = await db.insert(users).values({ displayName: "Маша" }).returning();
  const [list] = await db.insert(wishlists).values({ ownerId: owner!.id, title: "Маше 30", slug: "abc123" }).returning();
  const [item] = await db.insert(items).values({ wishlistId: list!.id, title: "Наушники" }).returning();
  itemId = item!.id;
});

describe("reservations constraints", () => {
  test("rejects a second active reservation for the same item", async () => {
    await db.insert(reservations).values({ itemId, guestName: "Аня", guestToken: "t1", cancelToken: "c1" });
    await expect(
      db.insert(reservations).values({ itemId, guestName: "Петя", guestToken: "t2", cancelToken: "c2" }),
    ).rejects.toThrow();
  });

  test("allows a new active reservation after the previous one is cancelled", async () => {
    await db.insert(reservations).values({ itemId, guestName: "Аня", guestToken: "t1", cancelToken: "c1", status: "cancelled" });
    await expect(
      db.insert(reservations).values({ itemId, guestName: "Петя", guestToken: "t2", cancelToken: "c2" }),
    ).resolves.toBeDefined();
  });
});

describe("auth identity constraints", () => {
  test("one provider account maps to exactly one user", async () => {
    const [u1] = await db.insert(users).values({ displayName: "A" }).returning();
    const [u2] = await db.insert(users).values({ displayName: "B" }).returning();
    await db.insert(authIdentities).values({ userId: u1!.id, provider: "vk", providerUserId: "777" });
    await expect(
      db.insert(authIdentities).values({ userId: u2!.id, provider: "vk", providerUserId: "777" }),
    ).rejects.toThrow();
  });
});
```

- [x] **Step 5: Тесты проходят**

Run: `pnpm vitest run packages/db && pnpm typecheck`
Expected: PASS (3 теста). Если тест «second active reservation» не падает на вставке — миграция сгенерирована без `WHERE`/индекса: вернуться к Step 3.

- [x] **Step 6: Скрипт миграций для прода**

`packages/db/scripts/migrate.mjs`:
```js
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  console.log("migrations applied");
} finally {
  await client.end();
}
```

- [x] **Step 7: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): schema, migrations and PGlite test harness"
```

---

### Task 6: Репозиторий пользователей и привязка аккаунтов (`packages/db/users`)

**Files:**
- Create: `packages/db/src/users.ts`
- Test: `packages/db/src/users.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `Database`, `users`, `authIdentities`, `AuthProvider` (Task 5).
- Produces:
  ```ts
  type IdentityInput = { provider: AuthProvider; providerUserId: string; displayName: string; avatarUrl: string | null };
  type UserRecord = { id: string; displayName: string; avatarUrl: string | null; surpriseMode: boolean };
  type UserWithIdentities = UserRecord & { providers: AuthProvider[] };
  function upsertUserFromIdentity(db: Database, input: IdentityInput): Promise<UserRecord>;
  function linkIdentity(db: Database, userId: string, input: IdentityInput): Promise<{ ok: true } | { ok: false; reason: "IDENTITY_TAKEN" | "PROVIDER_ALREADY_LINKED" }>;
  function getUserWithIdentities(db: Database, userId: string): Promise<UserWithIdentities | null>;
  ```

- [x] **Step 1: Падающие тесты**

`packages/db/src/users.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb } from "./testing";
import type { Database } from "./types";
import { getUserWithIdentities, linkIdentity, upsertUserFromIdentity } from "./users";

let db: Database;
beforeEach(async () => {
  db = await createTestDb();
});

const tg = { provider: "telegram" as const, providerUserId: "42", displayName: "Маша", avatarUrl: null };
const vk = { provider: "vk" as const, providerUserId: "777", displayName: "Мария", avatarUrl: "https://vk.ru/a.jpg" };

describe("upsertUserFromIdentity", () => {
  test("creates a user on first login", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(user).toMatchObject({ displayName: "Маша", avatarUrl: null, surpriseMode: false });
    expect(await getUserWithIdentities(db, user.id)).toMatchObject({ providers: ["telegram"] });
  });

  test("returns the same user on repeated login and refreshes the avatar", async () => {
    const first = await upsertUserFromIdentity(db, tg);
    const second = await upsertUserFromIdentity(db, { ...tg, avatarUrl: "https://t.me/new.jpg" });
    expect(second.id).toBe(first.id);
    expect(second.avatarUrl).toBe("https://t.me/new.jpg");
  });

  test("keeps different providers as different users until linked", async () => {
    const a = await upsertUserFromIdentity(db, tg);
    const b = await upsertUserFromIdentity(db, vk);
    expect(a.id).not.toBe(b.id);
  });
});

describe("linkIdentity", () => {
  test("links a second provider so both logins resolve to one user", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, user.id, vk)).toEqual({ ok: true });
    expect((await upsertUserFromIdentity(db, vk)).id).toBe(user.id);
    const withIds = await getUserWithIdentities(db, user.id);
    expect(withIds?.providers.sort()).toEqual(["telegram", "vk"]);
  });

  test("refuses to steal an identity that belongs to another user", async () => {
    await upsertUserFromIdentity(db, vk);
    const other = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, other.id, vk)).toEqual({ ok: false, reason: "IDENTITY_TAKEN" });
  });

  test("refuses a second account of the same provider", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, user.id, { ...tg, providerUserId: "43" })).toEqual({ ok: false, reason: "PROVIDER_ALREADY_LINKED" });
  });

  test("is a no-op when the identity is already linked to the same user", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, user.id, tg)).toEqual({ ok: true });
  });
});

describe("getUserWithIdentities", () => {
  test("returns null for an unknown id", async () => {
    expect(await getUserWithIdentities(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
```

- [x] **Step 2: Тесты падают**

Run: `pnpm vitest run packages/db/src/users.test.ts`
Expected: FAIL — `Failed to resolve import "./users"`.

- [x] **Step 3: Реализация**

`packages/db/src/users.ts`:
```ts
import { and, eq } from "drizzle-orm";
import { authIdentities, type AuthProvider, users } from "./schema";
import type { Database } from "./types";

export type IdentityInput = { provider: AuthProvider; providerUserId: string; displayName: string; avatarUrl: string | null };
export type UserRecord = { id: string; displayName: string; avatarUrl: string | null; surpriseMode: boolean };
export type UserWithIdentities = UserRecord & { providers: AuthProvider[] };

const userColumns = { id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, surpriseMode: users.surpriseMode };

async function findIdentityOwner(db: Database, provider: AuthProvider, providerUserId: string): Promise<string | null> {
  const rows = await db
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUserId, providerUserId)))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export async function upsertUserFromIdentity(db: Database, input: IdentityInput): Promise<UserRecord> {
  const existingUserId = await findIdentityOwner(db, input.provider, input.providerUserId);
  if (existingUserId) {
    if (input.avatarUrl === null) {
      const [existing] = await db.select(userColumns).from(users).where(eq(users.id, existingUserId)).limit(1);
      return existing!;
    }
    const [updated] = await db
      .update(users)
      .set({ avatarUrl: input.avatarUrl })
      .where(eq(users.id, existingUserId))
      .returning(userColumns);
    return updated!;
  }
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ displayName: input.displayName, avatarUrl: input.avatarUrl })
      .returning(userColumns);
    await tx.insert(authIdentities).values({ userId: created!.id, provider: input.provider, providerUserId: input.providerUserId });
    return created!;
  });
}

export async function linkIdentity(
  db: Database,
  userId: string,
  input: IdentityInput,
): Promise<{ ok: true } | { ok: false; reason: "IDENTITY_TAKEN" | "PROVIDER_ALREADY_LINKED" }> {
  const owner = await findIdentityOwner(db, input.provider, input.providerUserId);
  if (owner === userId) return { ok: true };
  if (owner !== null) return { ok: false, reason: "IDENTITY_TAKEN" };
  const sameProvider = await db
    .select({ id: authIdentities.id })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, input.provider)))
    .limit(1);
  if (sameProvider.length > 0) return { ok: false, reason: "PROVIDER_ALREADY_LINKED" };
  await db.insert(authIdentities).values({ userId, provider: input.provider, providerUserId: input.providerUserId });
  return { ok: true };
}

export async function getUserWithIdentities(db: Database, userId: string): Promise<UserWithIdentities | null> {
  const [user] = await db.select(userColumns).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const identities = await db
    .select({ provider: authIdentities.provider })
    .from(authIdentities)
    .where(eq(authIdentities.userId, userId));
  return { ...user, providers: identities.map((i) => i.provider) };
}
```

Примечание: при `avatarUrl: null` на повторном входе аватар не затирается (пользователь просто читается; пустой `update().set({})` Drizzle не допускает).

Добавить тест в `users.test.ts` в блок `upsertUserFromIdentity`:
```ts
  test("repeated login without avatar keeps the stored avatar", async () => {
    const first = await upsertUserFromIdentity(db, vk);
    const second = await upsertUserFromIdentity(db, { ...vk, avatarUrl: null });
    expect(second).toMatchObject({ id: first.id, avatarUrl: "https://vk.ru/a.jpg" });
  });
```
(итого 12 тестов в db после Step 4).

`packages/db/src/index.ts`:
```ts
export * as schema from "./schema";
export * from "./schema";
export type { Database } from "./types";
export { createDb } from "./client";
export * from "./users";
```

- [x] **Step 4: Тесты проходят**

Run: `pnpm vitest run packages/db && pnpm typecheck`
Expected: PASS (12 тестов в db).

- [x] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): user upsert and account linking"
```

---

### Task 7: Next.js-приложение и серверный слой аутентификации (`apps/web`)

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/vitest.config.ts`, `apps/web/public/.gitkeep`
- Create: `apps/web/src/server/env.ts`, `apps/web/src/server/db.ts`, `apps/web/src/server/http.ts`, `apps/web/src/server/auth-service.ts`
- Test: `apps/web/src/server/auth-service.test.ts`

**Interfaces:**
- Consumes: `verifyTelegramInitData`, `verifyTelegramLoginWidget`, `signSession`, `verifySession`, `signOAuthState`, `verifyOAuthState`, `createPkcePair`, `buildVkAuthorizeUrl`, `exchangeVkCode`, `fetchVkUser`, `FetchFn` (core); `Database`, `upsertUserFromIdentity`, `linkIdentity`, `getUserWithIdentities`, `UserWithIdentities` (db); `createTestDb` (db/testing).
- Produces:
  ```ts
  // env.ts
  type AppEnv = { APP_URL: string; DATABASE_URL: string; SESSION_SECRET: string; TELEGRAM_BOT_TOKEN: string; TELEGRAM_BOT_USERNAME: string; VK_CLIENT_ID: string };
  function readEnv(source?: Record<string, string | undefined>): AppEnv;
  function getEnv(): AppEnv;               // кэширует readEnv(process.env)
  // db.ts
  function getDb(): Database;
  // http.ts
  const SESSION_COOKIE = "wl_session"; const VK_STATE_COOKIE = "wl_vk_oauth";
  function sessionCookieOptions(): { httpOnly: true; secure: true; sameSite: "none"; path: "/"; maxAge: number };
  function isSameOrigin(request: Request, appUrl: string): boolean;
  // auth-service.ts
  type AuthDeps = { db: Database; env: AppEnv; now: () => Date; fetchFn: FetchFn };
  type AuthOutcome = { ok: true; sessionToken: string; userId: string } | { ok: false; error: string };
  function loginWithTelegramInitData(deps: AuthDeps, initData: string): Promise<AuthOutcome>;
  function loginWithTelegramWidget(deps: AuthDeps, params: URLSearchParams, currentSessionToken: string | null): Promise<AuthOutcome>;
  function startVkLogin(deps: AuthDeps, currentSessionToken: string | null): Promise<{ redirectUrl: string; stateCookie: string }>;
  function finishVkLogin(deps: AuthDeps, p: { code: string | null; deviceId: string | null; state: string | null; stateCookie: string | null; currentSessionToken: string | null }): Promise<AuthOutcome>;
  function getCurrentUser(deps: Pick<AuthDeps, "db" | "env">, sessionToken: string | null): Promise<UserWithIdentities | null>;
  ```

- [x] **Step 1: Пакет и конфиги**

`apps/web/package.json`:
```json
{
  "name": "@wishlist/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@wishlist/core": "workspace:*",
    "@wishlist/db": "workspace:*",
    "next": "16.3.5",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@types/react": "latest",
    "@types/react-dom": "latest"
  }
}
```
После `pnpm install` заменить `latest` на фактические версии из lock-файла.

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "allowJs": false,
    "types": ["node"],
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src", ".next/types/**/*.ts", "next.config.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:
```ts
import path from "node:path";
import type { NextConfig } from "next";

// `next build` запускается из apps/web (pnpm --filter), корень монорепо — на два уровня выше
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@wishlist/core", "@wishlist/db"],
  poweredByHeader: false,
};

export default nextConfig;
```

`apps/web/vitest.config.ts`:
```ts
import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "web", environment: "node", testTimeout: 30000 },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
```

`apps/web/public/.gitkeep` — пустой файл.

- [x] **Step 2: env, db, http**

`apps/web/src/server/env.ts`:
```ts
import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
  VK_CLIENT_ID: z.string().regex(/^\d+$/),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${fields}`);
  }
  return parsed.data;
}

let cached: AppEnv | null = null;
export function getEnv(): AppEnv {
  cached ??= readEnv();
  return cached;
}
```

`apps/web/src/server/db.ts`:
```ts
import { createDb, type Database } from "@wishlist/db";
import { getEnv } from "./env";

let db: Database | null = null;
export function getDb(): Database {
  db ??= createDb(getEnv().DATABASE_URL);
  return db;
}
```

`apps/web/src/server/http.ts`:
```ts
import { SESSION_TTL_SECONDS } from "@wishlist/core";

export const SESSION_COOKIE = "wl_session";
export const VK_STATE_COOKIE = "wl_vk_oauth";
const VK_STATE_MAX_AGE_SECONDS = 600;

export function sessionCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: SESSION_TTL_SECONDS } as const;
}

export function vkStateCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/vk", maxAge: VK_STATE_MAX_AGE_SECONDS } as const;
}

export function isSameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(appUrl).origin;
}
```

- [x] **Step 3: Падающие тесты сервиса**

`apps/web/src/server/auth-service.test.ts`:
```ts
import { createHash, createHmac } from "node:crypto";
import { signSession, verifySession } from "@wishlist/core";
import { getUserWithIdentities } from "@wishlist/db";
import { createTestDb } from "@wishlist/db/testing";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type AuthDeps,
  finishVkLogin,
  getCurrentUser,
  loginWithTelegramInitData,
  loginWithTelegramWidget,
  startVkLogin,
} from "./auth-service";
import type { AppEnv } from "./env";

const env: AppEnv = {
  APP_URL: "https://wishly.ru",
  DATABASE_URL: "unused",
  SESSION_SECRET: "s".repeat(64),
  TELEGRAM_BOT_TOKEN: "123456:TEST-TOKEN",
  TELEGRAM_BOT_USERNAME: "wishly_bot",
  VK_CLIENT_ID: "555",
};
const NOW = new Date("2026-09-14T12:00:00Z");
const nowSec = String(Math.floor(NOW.getTime() / 1000));

function dcs(fields: Record<string, string>) {
  return Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
}
function initData(user: object) {
  const fields = { auth_date: nowSec, user: JSON.stringify(user) };
  const secret = createHmac("sha256", "WebAppData").update(env.TELEGRAM_BOT_TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: createHmac("sha256", secret).update(dcs(fields)).digest("hex") }).toString();
}
function widgetParams(fields: Record<string, string>) {
  const secret = createHash("sha256").update(env.TELEGRAM_BOT_TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: createHmac("sha256", secret).update(dcs(fields)).digest("hex") });
}
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

let deps: AuthDeps;
beforeEach(async () => {
  deps = { db: await createTestDb(), env, now: () => NOW, fetchFn: vi.fn() };
});

describe("loginWithTelegramInitData", () => {
  test("creates a user and returns a valid session", async () => {
    const result = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await verifySession(result.sessionToken, env.SESSION_SECRET)).toBe(result.userId);
    expect(await getCurrentUser(deps, result.sessionToken)).toMatchObject({ displayName: "Маша", providers: ["telegram"] });
  });

  test("rejects a forged payload", async () => {
    const forged = initData({ id: 42, first_name: "Маша" }).replace("42", "43");
    expect(await loginWithTelegramInitData(deps, forged)).toEqual({ ok: false, error: "telegram_BAD_HASH" });
  });
});

describe("loginWithTelegramWidget", () => {
  test("logs in via widget and reuses the same user as the mini app", async () => {
    const viaMiniApp = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    const viaWidget = await loginWithTelegramWidget(deps, widgetParams({ id: "42", first_name: "Маша", auth_date: nowSec }), null);
    expect(viaWidget.ok && viaMiniApp.ok && viaWidget.userId === viaMiniApp.userId).toBe(true);
  });

  test("links telegram to the currently logged-in VK user", async () => {
    const vkUserSession = await vkLogin("777", null);
    const result = await loginWithTelegramWidget(deps, widgetParams({ id: "42", first_name: "Маша", auth_date: nowSec }), vkUserSession.token);
    expect(result).toMatchObject({ ok: true, userId: vkUserSession.userId });
    const user = await getUserWithIdentities(deps.db, vkUserSession.userId);
    expect(user?.providers.sort()).toEqual(["telegram", "vk"]);
  });
});

async function vkLogin(vkId: string, currentSessionToken: string | null) {
  const started = await startVkLogin(deps, currentSessionToken);
  const state = new URL(started.redirectUrl).searchParams.get("state");
  vi.mocked(deps.fetchFn)
    .mockResolvedValueOnce(json({ access_token: "at" }))
    .mockResolvedValueOnce(json({ user: { user_id: vkId, first_name: "Мария", avatar: "https://vk.ru/a.jpg" } }));
  const result = await finishVkLogin(deps, { code: "c", deviceId: "d", state, stateCookie: started.stateCookie, currentSessionToken });
  if (!result.ok) throw new Error(result.error);
  return { token: result.sessionToken, userId: result.userId };
}

describe("VK login", () => {
  test("start builds an id.vk.ru authorize url with PKCE", async () => {
    const started = await startVkLogin(deps, null);
    const url = new URL(started.redirectUrl);
    expect(url.origin).toBe("https://id.vk.ru");
    expect(url.searchParams.get("redirect_uri")).toBe("https://wishly.ru/api/auth/vk/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  test("finish creates a user from VK profile", async () => {
    const { token } = await vkLogin("777", null);
    expect(await getCurrentUser(deps, token)).toMatchObject({ displayName: "Мария", avatarUrl: "https://vk.ru/a.jpg", providers: ["vk"] });
  });

  test("finish rejects a state mismatch without calling VK", async () => {
    const started = await startVkLogin(deps, null);
    const result = await finishVkLogin(deps, { code: "c", deviceId: "d", state: "evil", stateCookie: started.stateCookie, currentSessionToken: null });
    expect(result).toEqual({ ok: false, error: "vk_state_mismatch" });
    expect(deps.fetchFn).not.toHaveBeenCalled();
  });

  test("finish rejects missing parameters", async () => {
    const result = await finishVkLogin(deps, { code: null, deviceId: "d", state: "s", stateCookie: null, currentSessionToken: null });
    expect(result).toEqual({ ok: false, error: "vk_missing_params" });
  });

  test("linking an identity owned by someone else fails", async () => {
    await vkLogin("777", null);
    const tgUser = await loginWithTelegramInitData(deps, initData({ id: 42, first_name: "Маша" }));
    if (!tgUser.ok) throw new Error("setup");
    const started = await startVkLogin(deps, tgUser.sessionToken);
    const state = new URL(started.redirectUrl).searchParams.get("state");
    vi.mocked(deps.fetchFn)
      .mockResolvedValueOnce(json({ access_token: "at" }))
      .mockResolvedValueOnce(json({ user: { user_id: "777", first_name: "Мария" } }));
    const result = await finishVkLogin(deps, { code: "c", deviceId: "d", state, stateCookie: started.stateCookie, currentSessionToken: tgUser.sessionToken });
    expect(result).toEqual({ ok: false, error: "link_IDENTITY_TAKEN" });
  });
});

describe("getCurrentUser", () => {
  test("returns null without a token, with a bad token, or for a deleted user", async () => {
    expect(await getCurrentUser(deps, null)).toBeNull();
    expect(await getCurrentUser(deps, "garbage")).toBeNull();
    const orphan = await signSession("00000000-0000-0000-0000-000000000000", env.SESSION_SECRET);
    expect(await getCurrentUser(deps, orphan)).toBeNull();
  });
});
```

- [x] **Step 4: Тесты падают**

Run: `pnpm install && pnpm vitest run apps/web`
Expected: FAIL — `Failed to resolve import "./auth-service"`.

- [x] **Step 5: Реализация сервиса**

`apps/web/src/server/auth-service.ts`:
```ts
import { randomBytes } from "node:crypto";
import {
  buildVkAuthorizeUrl,
  createPkcePair,
  exchangeVkCode,
  type FetchFn,
  fetchVkUser,
  signOAuthState,
  signSession,
  type TelegramUser,
  verifyOAuthState,
  verifySession,
  verifyTelegramInitData,
  verifyTelegramLoginWidget,
} from "@wishlist/core";
import {
  type Database,
  getUserWithIdentities,
  type IdentityInput,
  linkIdentity,
  upsertUserFromIdentity,
  type UserWithIdentities,
} from "@wishlist/db";
import type { AppEnv } from "./env";

export type AuthDeps = { db: Database; env: AppEnv; now: () => Date; fetchFn: FetchFn };
export type AuthOutcome = { ok: true; sessionToken: string; userId: string } | { ok: false; error: string };

const vkRedirectUri = (env: AppEnv) => new URL("/api/auth/vk/callback", env.APP_URL).toString();

function telegramIdentity(user: TelegramUser): IdentityInput {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return { provider: "telegram", providerUserId: String(user.id), displayName, avatarUrl: user.photoUrl };
}

async function loginOrLink(deps: AuthDeps, identity: IdentityInput, currentSessionToken: string | null): Promise<AuthOutcome> {
  const currentUserId = currentSessionToken ? await verifySession(currentSessionToken, deps.env.SESSION_SECRET) : null;
  if (currentUserId && (await getUserWithIdentities(deps.db, currentUserId))) {
    const linked = await linkIdentity(deps.db, currentUserId, identity);
    if (!linked.ok) return { ok: false, error: `link_${linked.reason}` };
    return { ok: true, userId: currentUserId, sessionToken: await signSession(currentUserId, deps.env.SESSION_SECRET) };
  }
  const user = await upsertUserFromIdentity(deps.db, identity);
  return { ok: true, userId: user.id, sessionToken: await signSession(user.id, deps.env.SESSION_SECRET) };
}

export async function loginWithTelegramInitData(deps: AuthDeps, initData: string): Promise<AuthOutcome> {
  const verified = verifyTelegramInitData(initData, deps.env.TELEGRAM_BOT_TOKEN, deps.now());
  if (!verified.ok) return { ok: false, error: `telegram_${verified.reason}` };
  const user = await upsertUserFromIdentity(deps.db, telegramIdentity(verified.user));
  return { ok: true, userId: user.id, sessionToken: await signSession(user.id, deps.env.SESSION_SECRET) };
}

export async function loginWithTelegramWidget(
  deps: AuthDeps,
  params: URLSearchParams,
  currentSessionToken: string | null,
): Promise<AuthOutcome> {
  const verified = verifyTelegramLoginWidget(params, deps.env.TELEGRAM_BOT_TOKEN, deps.now());
  if (!verified.ok) return { ok: false, error: `telegram_${verified.reason}` };
  return loginOrLink(deps, telegramIdentity(verified.user), currentSessionToken);
}

export async function startVkLogin(
  deps: AuthDeps,
  currentSessionToken: string | null,
): Promise<{ redirectUrl: string; stateCookie: string }> {
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = randomBytes(24).toString("base64url");
  const linkUserId = currentSessionToken ? await verifySession(currentSessionToken, deps.env.SESSION_SECRET) : null;
  const stateCookie = await signOAuthState({ state, codeVerifier, linkUserId }, deps.env.SESSION_SECRET);
  const redirectUrl = buildVkAuthorizeUrl({ clientId: deps.env.VK_CLIENT_ID, redirectUri: vkRedirectUri(deps.env), state, codeChallenge });
  return { redirectUrl, stateCookie };
}

export async function finishVkLogin(
  deps: AuthDeps,
  p: { code: string | null; deviceId: string | null; state: string | null; stateCookie: string | null; currentSessionToken: string | null },
): Promise<AuthOutcome> {
  if (!p.code || !p.deviceId || !p.state || !p.stateCookie) return { ok: false, error: "vk_missing_params" };
  const saved = await verifyOAuthState(p.stateCookie, deps.env.SESSION_SECRET);
  if (!saved || saved.state !== p.state) return { ok: false, error: "vk_state_mismatch" };

  const token = await exchangeVkCode({
    clientId: deps.env.VK_CLIENT_ID,
    redirectUri: vkRedirectUri(deps.env),
    code: p.code,
    codeVerifier: saved.codeVerifier,
    deviceId: p.deviceId,
    state: p.state,
    fetchFn: deps.fetchFn,
  });
  if (!token.ok) return { ok: false, error: `vk_${token.error}` };

  const profile = await fetchVkUser({ clientId: deps.env.VK_CLIENT_ID, accessToken: token.accessToken, fetchFn: deps.fetchFn });
  if (!profile.ok) return { ok: false, error: `vk_${profile.error}` };

  const identity: IdentityInput = {
    provider: "vk",
    providerUserId: profile.user.id,
    displayName: [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" "),
    avatarUrl: profile.user.avatarUrl,
  };
  return loginOrLink(deps, identity, p.currentSessionToken);
}

export async function getCurrentUser(
  deps: Pick<AuthDeps, "db" | "env">,
  sessionToken: string | null,
): Promise<UserWithIdentities | null> {
  if (!sessionToken) return null;
  const userId = await verifySession(sessionToken, deps.env.SESSION_SECRET);
  if (!userId) return null;
  return getUserWithIdentities(deps.db, userId);
}
```

- [x] **Step 6: Тесты проходят**

Run: `pnpm vitest run && pnpm typecheck`
Expected: PASS все проекты (core, db, web: 10 тестов), typecheck чистый.

- [x] **Step 7: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): auth service for telegram and VK login with account linking"
```

---

### Task 8: Route handlers и минимальные страницы входа

**Files:**
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/me/page.tsx`, `apps/web/src/app/tg/page.tsx`, `apps/web/src/app/tg/TelegramAutoLogin.tsx`
- Create: `apps/web/src/app/api/health/route.ts`, `apps/web/src/app/api/auth/telegram/miniapp/route.ts`, `apps/web/src/app/api/auth/telegram/widget/route.ts`, `apps/web/src/app/api/auth/vk/start/route.ts`, `apps/web/src/app/api/auth/vk/callback/route.ts`, `apps/web/src/app/api/auth/logout/route.ts`
- Create: `apps/web/src/server/deps.ts`

**Interfaces:**
- Consumes: всё из Task 7 (`AuthDeps`, функции сервиса, `getDb`, `getEnv`, cookie-хелперы).
- Produces: HTTP API:
  - `GET /api/health` → `200 {"ok":true}` / `503 {"ok":false}`
  - `POST /api/auth/telegram/miniapp` body `{"initData": string}` → `200 {"ok":true}` + cookie / `401 {"ok":false,"error":string}`
  - `GET /api/auth/telegram/widget?<telegram params>` → `303` на `/me` + cookie / `303` на `/login?error=...`
  - `GET /api/auth/vk/start` → `303` на `id.vk.ru` + state-cookie
  - `GET /api/auth/vk/callback?code&device_id&state` → `303` на `/me` / `/login?error=...`
  - `POST /api/auth/logout` → `303` на `/login`, очищает cookie (только same-origin)
  - Страницы: `/login`, `/me`, `/tg`
- `function authDeps(): AuthDeps` в `src/server/deps.ts`.

Этот слой — тонкие адаптеры без логики; логика протестирована в Task 7. Проверка — сборкой и ручным smoke-тестом в Task 10.

- [x] **Step 1: deps и route handlers**

`apps/web/src/server/deps.ts`:
```ts
import type { AuthDeps } from "./auth-service";
import { getDb } from "./db";
import { getEnv } from "./env";

export function authDeps(): AuthDeps {
  return { db: getDb(), env: getEnv(), now: () => new Date(), fetchFn: (input, init) => fetch(input, init) };
}
```

`apps/web/src/app/api/health/route.ts`:
```ts
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
```
Добавить `drizzle-orm` в зависимости `apps/web/package.json` той же версией `0.45.2`.

`apps/web/src/app/api/auth/telegram/miniapp/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loginWithTelegramInitData } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

const bodySchema = z.object({ initData: z.string().min(1).max(4096) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const result = await loginWithTelegramInitData(authDeps(), parsed.data.initData);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return response;
}
```

`apps/web/src/app/api/auth/telegram/widget/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { loginWithTelegramWidget } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

export async function GET(request: NextRequest) {
  const deps = authDeps();
  const result = await loginWithTelegramWidget(deps, request.nextUrl.searchParams, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!result.ok) return NextResponse.redirect(new URL(`/login?error=${result.error}`, deps.env.APP_URL), 303);
  const response = NextResponse.redirect(new URL("/me", deps.env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return response;
}
```

`apps/web/src/app/api/auth/vk/start/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { startVkLogin } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";

export async function GET(request: NextRequest) {
  const { redirectUrl, stateCookie } = await startVkLogin(authDeps(), request.cookies.get(SESSION_COOKIE)?.value ?? null);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(VK_STATE_COOKIE, stateCookie, vkStateCookieOptions());
  return response;
}
```

`apps/web/src/app/api/auth/vk/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { finishVkLogin } from "@/server/auth-service";
import { authDeps } from "@/server/deps";
import { SESSION_COOKIE, sessionCookieOptions, VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";

export async function GET(request: NextRequest) {
  const deps = authDeps();
  const q = request.nextUrl.searchParams;
  const result = await finishVkLogin(deps, {
    code: q.get("code"),
    deviceId: q.get("device_id"),
    state: q.get("state"),
    stateCookie: request.cookies.get(VK_STATE_COOKIE)?.value ?? null,
    currentSessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null,
  });
  const target = result.ok ? "/me" : `/login?error=${result.error}`;
  const response = NextResponse.redirect(new URL(target, deps.env.APP_URL), 303);
  response.cookies.set(VK_STATE_COOKIE, "", { ...vkStateCookieOptions(), maxAge: 0 });
  if (result.ok) response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  else console.warn("vk login failed", result.error);
  return response;
}
```

`apps/web/src/app/api/auth/logout/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { isSameOrigin, SESSION_COOKIE, sessionCookieOptions } from "@/server/http";

export async function POST(request: NextRequest) {
  const env = getEnv();
  if (!isSameOrigin(request, env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const response = NextResponse.redirect(new URL("/login", env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
```

- [x] **Step 2: Страницы**

`apps/web/src/app/globals.css`:
```css
:root {
  --cream: #f6f1e7;
  --graphite: #2c2c2a;
  --pink: #d4537e;
  --yellow: #ffe66d;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--cream); color: var(--graphite); font-family: var(--font-manrope), system-ui, sans-serif; }
.page { max-width: 480px; margin: 0 auto; padding: 32px 20px; }
.display { font-family: var(--font-playfair), Georgia, serif; font-size: 40px; line-height: 1.05; margin: 0 0 24px; }
.button { display: block; width: 100%; padding: 14px; border-radius: 999px; border: 0; background: var(--graphite); color: var(--cream); font: inherit; text-align: center; text-decoration: none; cursor: pointer; }
.muted { color: #5f5e5a; font-size: 14px; }
.error { color: var(--pink); font-size: 14px; }
```

`apps/web/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], style: ["normal", "italic"], variable: "--font-playfair" });

export const metadata: Metadata = { title: "Вишлист", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
```

`apps/web/src/app/login/TelegramLoginButton.tsx` (виджет Telegram вставляет iframe на место своего `<script>`, поэтому скрипт создаётся вручную внутри контейнера; `next/script` добавил бы его в конец `body`):
```tsx
"use client";

import { useEffect, useRef } from "react";

export function TelegramLoginButton({ botUsername, authUrl }: { botUsername: string; authUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = "large";
    script.dataset.radius = "20";
    script.dataset.authUrl = authUrl;
    script.dataset.requestAccess = "write";
    container.replaceChildren(script);
    return () => container.replaceChildren();
  }, [botUsername, authUrl]);

  return <div ref={containerRef} style={{ margin: "24px 0", minHeight: 40 }} />;
}
```

`apps/web/src/app/login/page.tsx`:
```tsx
import { getEnv } from "@/server/env";
import { TelegramLoginButton } from "./TelegramLoginButton";

export const dynamic = "force-dynamic";

const ERROR_TEXT: Record<string, string> = {
  link_IDENTITY_TAKEN: "Этот аккаунт уже привязан к другому профилю.",
  link_PROVIDER_ALREADY_LINKED: "К профилю уже привязан другой аккаунт этого сервиса.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const env = getEnv();
  return (
    <main className="page">
      <h1 className="display">
        Ваш <i>вишлист</i>
      </h1>
      {error && <p className="error">{ERROR_TEXT[error] ?? "Не получилось войти. Попробуйте ещё раз."}</p>}
      <TelegramLoginButton
        botUsername={env.TELEGRAM_BOT_USERNAME}
        authUrl={new URL("/api/auth/telegram/widget", env.APP_URL).toString()}
      />
      <a className="button" href="/api/auth/vk/start">
        Войти через VK ID
      </a>
    </main>
  );
}
```

`apps/web/src/app/me/page.tsx`:
```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth-service";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { SESSION_COOKIE } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const cookieStore = await cookies();
  const user = await getCurrentUser({ db: getDb(), env: getEnv() }, cookieStore.get(SESSION_COOKIE)?.value ?? null);
  if (!user) redirect("/login");
  const hasVk = user.providers.includes("vk");
  const hasTelegram = user.providers.includes("telegram");
  return (
    <main className="page">
      <h1 className="display">
        Привет, <i>{user.displayName}</i>
      </h1>
      <p className="muted">Вход через: {user.providers.join(", ")}</p>
      {!hasVk && (
        <a className="button" href="/api/auth/vk/start" style={{ marginBottom: 12 }}>
          Привязать VK ID
        </a>
      )}
      {!hasTelegram && <p className="muted">Чтобы привязать Telegram, войдите через Telegram на странице входа, не выходя из профиля.</p>}
      <form action="/api/auth/logout" method="post">
        <button className="button" type="submit">
          Выйти
        </button>
      </form>
    </main>
  );
}
```

`apps/web/src/app/tg/page.tsx` (`next/script` со `strategy="beforeInteractive"` в App Router разрешён только в корневом layout, поэтому SDK Telegram подгружает клиентский компонент):
```tsx
import { TelegramAutoLogin } from "./TelegramAutoLogin";

export default function TelegramEntryPage() {
  return (
    <main className="page">
      <h1 className="display">
        Открываем <i>вишлист</i>…
      </h1>
      <TelegramAutoLogin />
    </main>
  );
}
```

`apps/web/src/app/tg/TelegramAutoLogin.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TelegramWindow = Window & { Telegram?: { WebApp?: { initData: string; ready: () => void } } };

const TELEGRAM_SDK_URL = "https://telegram.org/js/telegram-web-app.js";

function loadTelegramSdk(): Promise<void> {
  if ((window as TelegramWindow).Telegram?.WebApp) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TELEGRAM_SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("telegram sdk failed to load"));
    document.head.appendChild(script);
  });
}

export function TelegramAutoLogin() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadTelegramSdk()
      .then(async () => {
        const webApp = (window as TelegramWindow).Telegram?.WebApp;
        if (!webApp?.initData) throw new Error("no init data");
        webApp.ready();
        const res = await fetch("/api/auth/telegram/miniapp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: webApp.initData }),
        });
        if (!res.ok) throw new Error(`login failed: ${res.status}`);
        router.replace("/me");
      })
      .catch((error: unknown) => {
        console.warn("telegram mini app login failed", error);
        setFailed(true);
      });
  }, [router]);

  if (!failed) return null;
  return <p className="error">Откройте эту страницу из Telegram-бота.</p>;
}
```

- [x] **Step 3: Сборка проходит локально**

Run: `pnpm --filter @wishlist/web build`
Expected: `✓ Compiled successfully`, в `apps/web/.next/standalone/apps/web/server.js` есть файл. Сборке нужны переменные окружения только в рантайме; если `next build` пытается пререндерить `/login` — страница помечена `force-dynamic`, ошибок быть не должно.

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): auth routes and minimal login, profile and mini app pages"
```

---

### Task 9: Docker-образы и GitHub Actions

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `.github/workflows/ci.yml`, `.github/workflows/images.yml`

**Interfaces:**
- Consumes: `pnpm test`, `pnpm typecheck`, `pnpm --filter @wishlist/web build`, `packages/db/scripts/migrate.mjs`.
- Produces: образы `ghcr.io/<owner>/wishlist-web:latest` (target `web`) и `ghcr.io/<owner>/wishlist-migrate:latest` (target `migrate`), теги также `sha-<короткий sha>`.

- [x] **Step 1: Dockerfile**

`apps/web/Dockerfile` (контекст — корень репозитория):
```dockerfile
ARG NODE_VERSION=24-slim

FROM node:${NODE_VERSION} AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @wishlist/web build

FROM node:${NODE_VERSION} AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/db ./packages/db
USER node
CMD ["node", "packages/db/scripts/migrate.mjs"]

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

Примечание для `migrate`: pnpm кладёт зависимости пакета в `packages/db/node_modules` (симлинки в `/repo/node_modules/.pnpm`), поэтому копируются и корневой `node_modules`, и весь `packages/db`.

- [x] **Step 2: Локальная проверка образов (если на машине есть Docker)**

Run: `docker build -f apps/web/Dockerfile --target web -t wishlist-web:local . && docker build -f apps/web/Dockerfile --target migrate -t wishlist-migrate:local .`
Expected: оба образа собираются. Если Docker локально нет — пропустить, проверка произойдёт в CI (Step 4).

- [x] **Step 3: Workflows**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
```

`.github/workflows/images.yml`:
```yaml
name: images
on:
  push:
    branches: [master]
permissions:
  contents: read
  packages: write
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target: [web, migrate]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        run: |
          owner=$(echo "${{ github.repository_owner }}" | tr '[:upper:]' '[:lower:]')
          echo "image=ghcr.io/${owner}/wishlist-${{ matrix.target }}" >> "$GITHUB_OUTPUT"
          echo "sha=sha-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          target: ${{ matrix.target }}
          push: true
          tags: |
            ${{ steps.meta.outputs.image }}:latest
            ${{ steps.meta.outputs.image }}:${{ steps.meta.outputs.sha }}
          cache-from: type=gha,scope=${{ matrix.target }}
          cache-to: type=gha,mode=max,scope=${{ matrix.target }}
```

- [x] **Step 4: Запушить и проверить CI**

```bash
git add apps/web/Dockerfile .github
git commit -m "ci: test workflow and GHCR image builds"
git push -u origin master
```
Run: `gh run list --limit 3` и `gh run watch` для последнего запуска.
Expected: `ci` и `images` — success; в GitHub → Packages появились `wishlist-web` и `wishlist-migrate`.

---

### Task 10: Деплой на общий VPS

**Files:**
- Create: `deploy/docker-compose.yml`, `deploy/Caddyfile.wishlist`, `deploy/server-setup.md`

**Interfaces:**
- Consumes: образы из Task 9; сеть `food-tracker-bot_default`; контейнеры `food-tracker-bot-db-1` (пользователь `food_tracker`) и `food-tracker-bot-caddy-1`; файл `/opt/food-tracker-bot/Caddyfile` (bind-mount одного файла).
- Produces: `https://APP_DOMAIN/api/health` → `{"ok":true}`; рабочий вход Telegram/VK на проде.

**Правило:** каждый блок команд ниже агент показывает пользователю и выполняет по SSH **только после явного «да»**. Секреты генерируются на сервере и не печатаются.

- [x] **Step 1: Файлы деплоя**

`deploy/docker-compose.yml`:
```yaml
name: wishlist

services:
  web:
    image: ghcr.io/${GHCR_OWNER}/wishlist-web:latest
    env_file: .env
    restart: unless-stopped
    mem_limit: 300m
    networks:
      shared:
        aliases: [wishlist-web]

  migrate:
    image: ghcr.io/${GHCR_OWNER}/wishlist-migrate:latest
    env_file: .env
    profiles: ["tools"]
    mem_limit: 200m
    networks: [shared]

networks:
  shared:
    external: true
    name: food-tracker-bot_default
```

`deploy/Caddyfile.wishlist` (подставить реальный домен перед копированием):
```
APP_DOMAIN {
	encode gzip
	reverse_proxy wishlist-web:3000
}
```

`deploy/server-setup.md` — скопировать туда шаги 2–7 этой задачи как runbook.

```bash
git add deploy
git commit -m "chore(deploy): compose, caddy block and server runbook"
git push
```

- [x] **Step 2: Swap 2 ГБ (с подтверждения)**

```bash
ssh root@200.169.178.231 '
set -e
if swapon --show | grep -q /swapfile; then echo "swap already enabled"; exit 0; fi
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q "^/swapfile " /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
sysctl -w vm.swappiness=10
echo "vm.swappiness=10" > /etc/sysctl.d/99-wishlist-swap.conf
free -h'
```
Expected: `Swap: 2.0Gi`.

- [x] **Step 3: БД и роль `wishlist` в общем Postgres (с подтверждения)**

SQL лежит в репозитории, чтобы не экранировать кавычки через SSH. `deploy/create-db.sql`:
```sql
SELECT format('CREATE ROLE wishlist LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wishlist') \gexec

SELECT 'CREATE DATABASE wishlist OWNER wishlist'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'wishlist') \gexec

SELECT datname FROM pg_database WHERE datname = 'wishlist';
```
(`:'pw'` подставляется psql из `-v pw=...` до отправки на сервер; `\gexec` выполняет сгенерированную команду.)

```bash
git add deploy/create-db.sql && git commit -m "chore(deploy): idempotent database bootstrap sql"
ssh root@200.169.178.231 'mkdir -p /opt/wishlist && chmod 700 /opt/wishlist'
scp deploy/create-db.sql root@200.169.178.231:/opt/wishlist/create-db.sql
ssh root@200.169.178.231 'set -e; cd /opt/wishlist; [ -f .db_password ] || { openssl rand -hex 24 > .db_password; chmod 600 .db_password; }; docker exec -i food-tracker-bot-db-1 psql -U food_tracker -d postgres -v ON_ERROR_STOP=1 -v pw="$(cat .db_password)" -At < create-db.sql'
```
Expected: последняя строка вывода `wishlist`. Повторный запуск безопасен (идемпотентно).

- [x] **Step 4: `.env` и compose на сервере (с подтверждения)**

Агент копирует compose, затем создаёт `.env`, **не выводя секретов**. Значения без секретов (домен, username бота, VK client_id, GHCR owner) пользователь сообщил заранее. Токен бота пользователь вписывает сам.

```bash
scp deploy/docker-compose.yml root@200.169.178.231:/opt/wishlist/docker-compose.yml
ssh root@200.169.178.231 '
set -e
cd /opt/wishlist
if [ ! -f .env ]; then
  PW=$(cat .db_password)
  cat > .env <<EOF
APP_URL=https://APP_DOMAIN
DATABASE_URL=postgres://wishlist:${PW}@db:5432/wishlist
SESSION_SECRET=$(openssl rand -hex 32)
TELEGRAM_BOT_TOKEN=PASTE_TOKEN_HERE
TELEGRAM_BOT_USERNAME=BOT_USERNAME
VK_CLIENT_ID=VK_CLIENT_ID
GHCR_OWNER=GHCR_OWNER
EOF
  chmod 600 .env
fi
grep -c "=" .env'
```
Затем **пользователь сам** выполняет на сервере: `nano /opt/wishlist/.env` (вписать `TELEGRAM_BOT_TOKEN`) и `docker login ghcr.io` (PAT со scope `read:packages`).

- [x] **Step 5: Миграции и запуск (с подтверждения)**

```bash
ssh root@200.169.178.231 '
set -e
cd /opt/wishlist
docker compose pull
docker compose run --rm migrate
docker compose up -d web
sleep 15
docker compose ps
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"'
```
Expected: `migrations applied`; `wishlist-web-1` в статусе `healthy`; память `web` < 300MiB; контейнеры трекера по-прежнему `Up`.

- [x] **Step 6: Блок в Caddyfile трекера (с подтверждения)**

Файл смонтирован как один файл — **нельзя** использовать `sed -i`/редакторы, заменяющие inode; только дописывание `>>`.

```bash
ssh root@200.169.178.231 '
set -e
cd /opt/food-tracker-bot
cp Caddyfile Caddyfile.bak-$(date +%Y%m%d%H%M%S)
grep -q "wishlist-web:3000" Caddyfile || printf "\nAPP_DOMAIN {\n\tencode gzip\n\treverse_proxy wishlist-web:3000\n}\n" >> Caddyfile
docker exec food-tracker-bot-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec food-tracker-bot-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
sleep 20
curl -fsS https://APP_DOMAIN/api/health && curl -fsS -o /dev/null -w "trackermeal %{http_code}\n" https://trackermeal.ru'
```
Expected: `{"ok":true}` и `trackermeal 200` (или прежний код ответа трекера). Если `validate` упал — **не** делать reload, восстановить из `Caddyfile.bak-*` и сообщить пользователю.

- [x] **Step 7: Smoke-тест входа (вместе с пользователем)**

1. Открыть `https://APP_DOMAIN/login` → нажать виджет Telegram → попадаем на `/me` с именем, «Вход через: telegram».
2. На `/me` нажать «Привязать VK ID» → после VK попадаем на `/me`, «Вход через: telegram, vk».
3. «Выйти» → `/login`. Войти через VK ID → тот же профиль (оба провайдера в списке).
4. В @BotFather кнопка меню бота → Mini App открывает `/tg` → автоматически `/me`.
5. Проверить на сервере: `docker compose -f /opt/wishlist/docker-compose.yml logs web --tail 50` — без ошибок; `free -h` — есть запас памяти.

Если шаг 4 падает с `telegram_BAD_HASH` при корректном токене — проверить, что Telegram не добавил в `initData` поле, требующее исключения из data-check-string (в текущей реализации исключается только `hash`); зафиксировать реальный `initData` (без публикации) и добавить регрессионный тест в `telegram.test.ts`.

- [x] **Step 8: Commit runbook-правок (если были)**

```bash
git add deploy docs
git commit -m "docs(deploy): record production setup notes"
git push
```

---

## Что дальше

План 2 — «Списки, подарки, бронирование + UI Журнала» — опирается на: `@wishlist/core` (`decideReserve`, `decideCancel`, `ownerReservationView`, `guestReservationView`), `@wishlist/db` (`wishlists`, `items`, `reservations`, `createTestDb`), `getCurrentUser`, cookie `wl_session`, деплой из Task 10. В нём же — локальный dev-сервер БД (PGlite socket или Docker Desktop) для `next dev`.

**Добавить в план 2 по итогам проверки на проде:** автоматическое объединение профилей. Если залогиненный пользователь привязывает аккаунт (Telegram/VK), который уже принадлежит **пустому** профилю (нет списков и броней), — перенести identity и удалить пустой профиль вместо ошибки `link_IDENTITY_TAKEN`. Сценарий: человек сначала вошёл через VK, потом через Telegram и пытается связать их. Если чужой профиль не пустой — оставить текущую ошибку.

Сознательно **не** входит в план 1 (YAGNI, появится там, где нужно):
- таблицы `ParseCache` и очередь pg-boss, приложение `apps/worker` — план 3 (парсер);
- бот grammY, напоминания — план 4;
- таблицы `Theme`, `Purchase`, `AffiliateClick`, ЮKassa — план 5;
- ночные бэкапы `pg_dump` в S3 и uptime-алерты (спека 4.6) — план 3, вместе с подключением S3.

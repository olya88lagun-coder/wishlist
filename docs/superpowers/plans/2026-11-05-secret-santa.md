# Тайный Санта: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Игра «Тайный Санта»: организатор создаёт игру, участники вступают по ссылке без входа, жеребьёвка, каждый видит вишлист получателя; уведомления в Telegram.

**Architecture:** Участник без входа — анонимный пользователь (`users.is_anonymous`) с обычной сессией и обычным вишлистом, поэтому вся механика списков и партнёрских ссылок работает без изменений. Вход через Telegram/VK привязывает идентичность к анонимному пользователю или переносит его данные в существующий аккаунт. Сессии получают версию, чтобы старые cookie переставали действовать после привязки.

**Tech Stack:** Next.js (App Router, server actions) в `apps/web`, Drizzle + Postgres в `packages/db`, pg-boss воркер с ботом в `apps/worker`, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-secret-santa-design.md`

## Global Constraints

- Срок запуска: 25 ноября 2026.
- `santa_games.title` до 80 символов, `budget_text` до 40, `display_name` участника до 40.
- До 30 участников в игре, до 20 игр на организатора, жеребьёвка от 3 участников.
- `join_code`, личные токены и токены восстановления: 32 случайных байта, base64url; токены хранятся в БД только хэшем SHA-256.
- Списки игры: `occasion = "new_year"`, название «Тайный Санта: <название игры>».
- Анонимные данные удаляются через 60 дней после самой поздней `exchange_date` среди игр пользователя.
- Напоминание — за 2 дня до `exchange_date`.
- Аналитика: события `santa_created`, `santa_joined` (`signed_in`), `santa_drawn`, `santa_recipient_opened`; `auth_completed` из игры — с `source=santa`. Имена, ID и токены в Метрику не передавать.
- Страницы `/santa/*` — минимальная семантичная разметка без стилей и без новых CSS-классов; оформление делает Codex.
- e2e запускать с `--workers=1` (локальная PGlite).

## Review Focus

- Два участника вступают, пока организатор жмёт «Провести жеребьёвку»: вступление после фиксации статуса `drawn` должно отклоняться, никто не остаётся без пары. Тест в Task 3.
- Тот же браузер открывает ссылку вступления повторно: возвращается существующий участник, а не второй анонимный пользователь. Тест в Task 3.
- Участник удалил свой список игры: страница Санты показывает «список удалён», а не 500. Тест в Task 5.
- Организатор открывает ссылку вступления своей игры: он уже участник, дубля нет. Тест в Task 3.
- Анонимный участник, вошедший через Telegram с существующим аккаунтом, видит игру в существующем аккаунте и ничего не теряет. Тест в Task 4.

---

### Task 1: Схема и миграция

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0013_secret_santa.sql` (через `pnpm --filter @wishlist/db db:generate`, затем переименовать тег, если генератор дал другое имя)
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Produces:
  - `users.isAnonymous: boolean` (default false), `users.sessionVersion: integer` (default 0).
  - `santaGameStatusEnum = pgEnum("santa_game_status", ["open", "drawn"])`.
  - `santaGames`: `id uuid pk`, `organizerId uuid → users.id on delete cascade`, `title text`, `budgetText text`, `exchangeDate date (mode string)`, `joinCode text unique`, `status santaGameStatusEnum default "open"`, `drawnAt timestamptz null`, `createdAt`. Индекс по `organizerId`.
  - `santaParticipants`: `id uuid pk`, `gameId → santaGames.id on delete cascade`, `userId → users.id on delete cascade`, `wishlistId → wishlists.id on delete set null` (nullable), `displayName text`, `recipientParticipantId uuid null`, `personalTokenHash text null unique`, `recoveryTokenHash text null unique`, `createdAt`. Уникальный индекс (`gameId`, `userId`).

- [ ] **Step 1:** Добавить в `schema.test.ts` тест `santa tables accept a game with participants and reject a duplicate participant`: вставить пользователя, игру, двух участников; вставка второго участника с тем же `userId` в ту же игру бросает ошибку; удаление игры удаляет участников; удаление списка ставит `wishlistId = null`.
- [ ] **Step 2:** `npx vitest run packages/db/src/schema.test.ts` — FAIL (нет таблиц).
- [ ] **Step 3:** Описать таблицы и поля в `schema.ts`, сгенерировать миграцию.
- [ ] **Step 4:** `npx vitest run packages/db/src/schema.test.ts` — PASS; `pnpm typecheck` — без ошибок.
- [ ] **Step 5:** Commit `feat(db): таблицы Тайного Санты и флаги анонимного пользователя`.

### Task 2: Версия сессии

**Files:**
- Modify: `packages/core/src/auth/session.ts`, `apps/web/src/server/auth-service.ts`, `packages/db/src/users.ts`
- Test: `packages/core/src/auth/session.test.ts`, `apps/web/src/server/auth-service.test.ts`

**Interfaces:**
- Produces:
  - `signSession(userId: string, secret: string, version = 0): Promise<string>` — кладёт claim `v`.
  - `verifySessionClaims(token: string, secret: string): Promise<{ userId: string; version: number } | null>` — отсутствующий `v` считается 0. `verifySession` остаётся и возвращает `userId`.
  - `bumpSessionVersion(db: Database, userId: string): Promise<number>` в `users.ts` — возвращает новую версию.
  - `getCurrentUser` возвращает `null`, если `version` из токена ≠ `users.session_version`.
  - `UserWithIdentities` получает поля `isAnonymous: boolean`, `sessionVersion: number`.

- [ ] **Step 1:** Тесты: `session.test.ts` — `old tokens without v verify as version 0`, `signed version round-trips`; `auth-service.test.ts` — `getCurrentUser rejects a token whose version is behind the user`.
- [ ] **Step 2:** Запустить оба файла vitest — FAIL.
- [ ] **Step 3:** Реализовать. Все существующие `signSession(...)` в `auth-service.ts` передают `user.sessionVersion` (для `loginOrLink` — версию из БД после привязки).
- [ ] **Step 4:** `npx vitest run packages/core apps/web/src/server` — PASS; `pnpm typecheck`.
- [ ] **Step 5:** Commit `feat(auth): версия сессии для отзыва старых cookie`.

### Task 3: Логика игры в `packages/db`

**Files:**
- Create: `packages/db/src/santa.ts`, `packages/db/src/santa.test.ts`
- Modify: `packages/db/src/index.ts` (экспорт), `packages/db/src/limits.ts`

**Interfaces:**
- Consumes: таблицы Task 1, `createWishlist` из `wishlists.ts`.
- Produces (все в `santa.ts`):
  - `limits.ts`: `SANTA_MAX_PARTICIPANTS = 30`, `SANTA_MAX_GAMES_PER_ORGANIZER = 20`, `SANTA_MIN_PARTICIPANTS = 3`, `SANTA_TITLE_MAX = 80`, `SANTA_BUDGET_MAX = 40`, `SANTA_NAME_MAX = 40`.
  - `createAnonymousUser(db, displayName: string): Promise<{ userId: string }>`.
  - `createSantaGame(db, organizerId: string, input: { title: string; budgetText: string; exchangeDate: string; organizerName: string }): Promise<{ ok: true; gameId: string; joinCode: string } | { ok: false; reason: "INVALID" | "LIMIT" | "ANONYMOUS_ORGANIZER" }>` — создаёт и участника-организатора с его списком.
  - `joinSantaGame(db, joinCode: string, userId: string, displayName: string): Promise<{ ok: true; participantId: string; gameId: string; personalToken: string | null; alreadyJoined: boolean } | { ok: false; reason: "NOT_FOUND" | "CLOSED" | "FULL" | "INVALID_NAME" }>` — блокирует игру `FOR UPDATE`; `personalToken` выдаётся только анонимному пользователю при первом вступлении.
  - `drawSantaGame(db, gameId: string, organizerId: string, random = randomInt): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_ORGANIZER" | "ALREADY_DRAWN" | "TOO_FEW" }>` — Фишер — Йетс + круг, в одной транзакции с `FOR UPDATE`; обнуляет все `recoveryTokenHash`.
  - `removeSantaParticipant(db, gameId, organizerId, participantId): Promise<boolean>` — только до жеребьёвки, не организатора.
  - `issueRecoveryToken(db, gameId, organizerId, participantId): Promise<string | null>` — только до жеребьёвки и только для анонимного участника.
  - `redeemSantaToken(db, token: string): Promise<{ userId: string; gameId: string } | null>` — принимает личный токен или токен восстановления; токен восстановления гасит; возвращает `null`, если у пользователя есть идентичность.
  - `getSantaGameView(db, gameId: string, userId: string): Promise<SantaGameView | null>` — `null`, если пользователь не участник. `SantaGameView = { game: { id; title; budgetText; exchangeDate; status; joinCode: string | null /* только организатору */ }; isOrganizer: boolean; me: { participantId; wishlistId: string | null; wishlistSlug: string | null }; participants: { id; displayName; itemCount: number; signedIn: boolean }[]; recipient: { displayName: string; wishlistSlug: string | null } | null }`. Организатору не возвращать `recipient` других участников ни в каком виде.
  - `listSantaGamesForUser(db, userId): Promise<{ id: string; title: string; status: "open" | "drawn" }[]>`.

- [ ] **Step 1:** Тесты в `santa.test.ts`:
  - `draw gives everyone exactly one recipient and nobody themselves` — для 3, 4, 30 участников и 50 разных seed `random`.
  - `second draw is rejected and does not reshuffle`.
  - `join after draw returns CLOSED`; `31st participant returns FULL`; `21st game returns LIMIT`.
  - `join is idempotent for the same user` — `alreadyJoined: true`, тот же `participantId`, `personalToken: null`.
  - `organizer opening own join link is alreadyJoined`.
  - `concurrent join and draw` — `Promise.all([drawSantaGame(...), joinSantaGame(...)])`: либо вступление до жеребьёвки и у нового участника есть пара, либо `CLOSED`.
  - `organizer view has no recipients of others`; `participant view after draw has recipient name and slug`.
  - `recovery token works once, dies on draw, and is refused for users with an identity`.
  - `personal token stops working after identity is linked`.
- [ ] **Step 2:** `npx vitest run packages/db/src/santa.test.ts` — FAIL.
- [ ] **Step 3:** Реализовать. Алгоритм жеребьёвки:

```ts
const order = [...participants];
for (let i = order.length - 1; i > 0; i--) { const j = random(i + 1); [order[i], order[j]] = [order[j]!, order[i]!]; }
order.forEach((p, i) => assign(p.id, order[(i + 1) % order.length]!.id));
```

- [ ] **Step 4:** `npx vitest run packages/db` — PASS.
- [ ] **Step 5:** Commit `feat(db): игра Тайный Санта — создание, вступление, жеребьёвка`.

### Task 4: Привязка входа к анонимному пользователю и перенос

**Files:**
- Modify: `packages/db/src/users.ts`, `apps/web/src/server/auth-service.ts`
- Create: `packages/db/src/anonymous-merge.ts`, `packages/db/src/anonymous-merge.test.ts`
- Test: `apps/web/src/server/auth-service.test.ts`

**Interfaces:**
- Consumes: `bumpSessionVersion` (Task 2), `createAnonymousUser`, `joinSantaGame` (Task 3).
- Produces:
  - `mergeAnonymousUser(db, anonymousUserId: string, targetUserId: string): Promise<void>` — одна транзакция: переносит `wishlists.owner_id`, `santa_participants.user_id` (дубль в той же игре: до жеребьёвки удалить запись анонимного участника, после — оставить обе), `santa_games.organizer_id`, `reservations.guest_user_id`, `wishlist_deletion_notices.guest_user_id`, `notification_log`, `feature_interest` (без дублей по уникальному индексу), `design_purchases.user_id`; удаляет анонимного пользователя. Настройки берутся от `target`.
  - `linkIdentity` при привязке к анонимному пользователю снимает `is_anonymous` и вызывает `bumpSessionVersion`.
  - `loginOrLink`: если текущий пользователь анонимный и `linkIdentity` вернул `IDENTITY_TAKEN` — `mergeAnonymousUser(current, owner)` и сессия владельца идентичности. Для неанонимных поведение прежнее.

- [ ] **Step 1:** Тесты: `anonymous-merge.test.ts` — `merge moves lists, santa participation, reservations, purchases and deletes the anonymous user`; `merge keeps target settings`; `merge with the same game before draw leaves one participant`. `auth-service.test.ts` — `anonymous user linking a new telegram identity keeps its data and old cookie stops working`; `anonymous user signing in with an existing account is merged into it`; `regular user linking a taken identity still gets link_IDENTITY_TAKEN`.
- [ ] **Step 2:** vitest по обоим файлам — FAIL.
- [ ] **Step 3:** Реализовать.
- [ ] **Step 4:** `npx vitest run packages/db apps/web/src/server` — PASS; `pnpm typecheck`.
- [ ] **Step 5:** Commit `feat(auth): вход анонимного участника привязывается или переносится в аккаунт`.

### Task 5: Страницы и действия `/santa`

**Files:**
- Create: `apps/web/src/app/santa/new/page.tsx`, `apps/web/src/app/santa/actions.ts`, `apps/web/src/app/santa/[id]/page.tsx`, `apps/web/src/app/santa/join/[code]/page.tsx`, `apps/web/src/app/santa/me/[token]/route.ts`
- Modify: `apps/web/src/server/rate-limit.ts` (`santaJoinLimiter = createRateLimiter({ limit: 10, windowMs: MINUTE_MS })`), `apps/web/src/lib/analytics-events.ts` (события и ключ `source` уже есть), `apps/web/src/app/lists/page.tsx` (блок «Мои игры» из `listSantaGamesForUser`), `apps/web/src/app/privacy/page.tsx` (срок хранения 60 дней)
- Test: `apps/web/src/app/santa/actions.test.ts`, `e2e/secret-santa.spec.ts`

**Interfaces:**
- Consumes: всё из Task 3, `ensureGuestViewer`/`readViewer`/`requireUser`, `SESSION_COOKIE` и `sessionCookieOptions()`, `signSession`.
- Produces (server actions в `actions.ts`): `createSantaGameAction`, `joinSantaGameAction(code, prevState, formData)` (без сессии — `createAnonymousUser` и выдача cookie), `drawSantaGameAction(gameId)`, `removeSantaParticipantAction(gameId, participantId)`, `issueRecoveryLinkAction(gameId, participantId)`. Маршрут `/santa/me/[token]`: `redeemSantaToken` → cookie сессии → редирект на `/santa/<gameId>`; неверный токен → 404.

- [ ] **Step 1:** `actions.test.ts`: `join without session creates anonymous user and sets session cookie`; `join is rate limited per client key`; `draw by non-organizer is refused`. `e2e/secret-santa.spec.ts`: организатор (dev-login) создаёт игру → два гостя в отдельных контекстах вступают по ссылке, добавляют по подарку → организатор проводит жеребьёвку → каждый гость видит имя получателя и открывает его список; страница организатора не содержит имён получателей; гость открывает свою личную ссылку в новом контексте и видит ту же игру; участник удалил свой список → его Санта видит «список удалён».
- [ ] **Step 2:** vitest и `npx playwright test -c e2e/playwright.config.ts e2e/secret-santa.spec.ts --workers=1` — FAIL.
- [ ] **Step 3:** Реализовать страницы с минимальной разметкой; события аналитики — через существующие `trackEvent` и `withActionAnalytics`. Кнопки входа на страницах игры передают `returnTo=/santa/<id>`; `auth_completed` после такого входа отправляется с `source: "santa"`.
- [ ] **Step 4:** Тесты из Step 2 — PASS; `pnpm typecheck`; e2e `reserve-dialog`, `main-flow` с `--workers=1` — PASS.
- [ ] **Step 5:** Commit `feat(web): страницы Тайного Санты`.

### Task 6: Уведомления

**Files:**
- Modify: `packages/core/src/queues.ts`, `apps/web/src/server/queue.ts`, `apps/worker/src/notify.ts`, `apps/worker/src/reminders.ts`, `apps/worker/src/bot/texts.ts`
- Test: `apps/worker/src/notify.test.ts`, `apps/worker/src/reminders.test.ts`

**Interfaces:**
- Consumes: `drawSantaGameAction` ставит задачу после успеха.
- Produces: `NotifyJob` += `{ kind: "santa_drawn"; gameId: string }`. Воркер шлёт каждому участнику с Telegram-идентичностью сообщение с именем получателя и ссылкой `APP_URL/santa/<gameId>`. `reminders.ts` раз в день шлёт напоминание участникам игр с `status = "drawn"` и `exchange_date = today + 2` (Europe/Moscow); повторная отправка исключается через `notification_log`.

- [ ] **Step 1:** Тесты: `santa_drawn notifies only telegram participants with their own recipient`; `santa reminder is sent once two days before exchange`.
- [ ] **Step 2:** vitest — FAIL.
- [ ] **Step 3:** Реализовать.
- [ ] **Step 4:** `npx vitest run apps/worker` — PASS.
- [ ] **Step 5:** Commit `feat(worker): уведомления Тайного Санты`.

### Task 7: Очистка анонимных данных

**Files:**
- Modify: `apps/worker/src/maintenance.ts`, `packages/db/src/santa.ts`
- Test: `packages/db/src/santa.test.ts`

**Interfaces:**
- Produces: `deleteExpiredSantaData(db, today: string): Promise<{ users: number; games: number }>` — удаляет игры, у которых `exchange_date + 60 дней < today`, и анонимных пользователей без идентичностей, у которых все игры старше этого срока. Вызывается из `runMaintenance`.

- [ ] **Step 1:** Тест `cleanup removes old anonymous users and games but keeps users with an identity and recent games`.
- [ ] **Step 2:** vitest — FAIL.
- [ ] **Step 3:** Реализовать и вызвать из `runMaintenance`.
- [ ] **Step 4:** `npx vitest run` — PASS; `pnpm typecheck`.
- [ ] **Step 5:** Commit `feat(worker): удаление данных Тайного Санты через 60 дней`.

### Передача Codex

После Task 5 записать в `docs/superpowers/specs/2026-11-05-secret-santa-design.md` раздел «Для Codex»: список страниц `/santa/*`, какие данные доступны в каждой (`SantaGameView`), какие элементы и тексты обязательны (ссылка вступления с копированием, кнопка жеребьёвки, «ссылка для возврата», предложение входа через Telegram, крупное предложение сохранить личную ссылку), и запрет менять `actions.ts`, `route.ts` и `packages/db`.

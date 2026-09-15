# Task 11: BotFather, окружение, CI, деплой и проверка на проде

**Files:**
- Modify: `deploy/server-setup.md` (раздел «Бот»), `docs/superpowers/plans/2026-09-16-plan-4-bot/00-overview.md` (статус), `task-*.md` (отметки шагов)

**Interfaces:**
- Consumes: всё из Tasks 1–10; миграция `0002_*` (Task 1); переменная `ADMIN_TELEGRAM_ID` (Task 4); команда `/myid` (Task 6).
- Produces: работающий бот на проде; статус плана.

Каждая команда на сервере — только после явного «да» пользователя. Токен бота и прочие секреты в чат и команды не попадают.

- [ ] **Step 1: Полная проверка ветки**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build && pnpm --filter @wishlist/worker build`
Expected: PASS.

```bash
git push -u origin feat/bot
```
Попросить пользователя проверить в Actions запуск `ci` на `feat/bot` — зелёный. При красном — получить текст ошибки и исправить.

- [ ] **Step 2: Документация сервера**

В `deploy/server-setup.md` после раздела «Фото, бэкапы и воркер» добавить:
````markdown
## Бот

Бот работает внутри контейнера `worker` (long polling). Он использует те же `TELEGRAM_BOT_TOKEN`, `APP_URL` и `SESSION_SECRET`, что и web.

- `ADMIN_TELEGRAM_ID` — кому слать алерты canary парсера (ежедневно 10:00 МСК) и проверки сайта (каждые 5 минут). Узнать id: написать боту `/myid`.
- Inline-режим включается в @BotFather: `/setinline` → выбрать бота → подсказка «название списка».
- Напоминания гостям — ежедневно в 12:00 МСК.
- Одновременно токен может опрашивать только один процесс: не запускать второй воркер с боевым токеном (Telegram ответит 409 Conflict).

Проверка:
```bash
docker logs --since 10m wishlist-worker-1 2>&1 | grep -E '"(bot polling started|worker started)"'
```
````

```bash
git add deploy docs
git commit -m "docs: bot operations on the server"
git push
```

- [ ] **Step 3: BotFather (делает пользователь)**

1. В @BotFather: `/setinline` → `@my_wish_list1_bot` → текст подсказки `название списка`.
2. Больше ничего менять не нужно: команды и кнопку меню бот выставит сам при запуске.

- [ ] **Step 4: Мерж в master и сборка образов (с согласия пользователя)**

```bash
git checkout master && git pull --ff-only && git merge --ff-only feat/bot && git push
```
Попросить пользователя дождаться зелёного `images` (web, migrate, worker) для нового коммита.

- [ ] **Step 5: Деплой (только после «да»)**

Скрипт в scratchpad (`$TEMP/deploy-bot.sh`), запуск `ssh root@200.169.178.231 'bash -s' < "$TEMP/deploy-bot.sh"`:
```bash
set -e
cd /opt/wishlist
docker compose --profile tools pull 2>&1 | grep -E "Pulled|error" || true
docker compose run --rm migrate </dev/null 2>&1 | grep -E "migrations applied|ERROR"
docker exec food-tracker-bot-db-1 psql -U wishlist -d wishlist -tA -c "select count(*) from drizzle.__drizzle_migrations" -c "select to_regclass('public.notification_log')"
docker compose up -d web worker 2>&1 | tail -2
sleep 25
docker compose ps --format "{{.Name}} {{.Status}}"
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}" | grep wishlist
docker logs --since 1m wishlist-worker-1 2>&1 | tail -6
curl -fsS https://my-wish-list.online/api/health; echo
```
Expected:
- `migrations applied`; миграций `3`; `notification_log` существует;
- `wishlist-web-1 ... (healthy)`, `wishlist-worker-1 ... Up`;
- worker < 200 МиБ (grammY добавляет ~10–20 МиБ);
- в логе `"bot polling started"` и `"worker started"` с `"telegram":true`, без `error`;
- `{"ok":true}`.

Если в логе `telegram bot token rejected` — токен в `.env` неверный; если `409: Conflict` — где-то запущен второй процесс с этим токеном (например, локальный воркер с боевым токеном).

- [ ] **Step 6: Администратор (пользователь + «да»)**

1. Пользователь пишет боту `/myid` → получает число.
2. Пользователь дописывает в `/opt/wishlist/.env` строку `ADMIN_TELEGRAM_ID=<число>`.
3. После «да»:
```bash
ssh root@200.169.178.231 'cd /opt/wishlist && grep -c "^ADMIN_TELEGRAM_ID=[0-9]" .env && docker compose up -d worker && sleep 15 && docker logs --since 30s wishlist-worker-1 2>&1 | tail -3'
```
Expected: `1`, воркер перезапущен, `bot polling started`.

- [ ] **Step 7: Проверка на проде вместе с пользователем**

1. **/start:** в боте `/start` → приветствие и кнопка «Открыть вишлист» → открывается Mini App со списками.
2. **Ссылка боту:** отправить ссылку на Wildberries → сразу карточка «Загружаем данные из магазина…» → через ~10 с сообщение обновилось: фото сверху, название, цена, «В списке «…»». В приложении подарок появился в последнем списке.
3. **Несколько ссылок:** одно сообщение со ссылками на Золотое Яблоко и Яндекс Маркет → две карточки, обе заполнились.
4. **Без ссылки:** «привет» → подсказка про ссылку.
5. **В список ▾:** выбрать другой список → карточка показывает новый список; в приложении подарок переехал. «← Назад» возвращает кнопки.
6. **Изменить:** открывает Mini App сразу на странице списка с этим подарком.
7. **Удалить:** карточка превратилась в «Удалил «…» из списка «…».», в приложении подарка нет.
8. **Бронь из Mini App (второй аккаунт Telegram или попросить знакомого):** гость бронирует подарок → владельцу приходит «Кто-то забронировал…» без имени; гостю — «Готово! Вы дарите…» с кнопками «Открыть список» и «Снять бронь». «Снять бронь» → «Бронь снята…», на странице списка подарок свободен.
9. **Режим сюрприза:** владелец включает «Полный сюрприз» → новая бронь → владельцу ничего не приходит, гостю подтверждение приходит.
10. **Гость с сайта:** в браузере без входа забронировать подарок → под подарком «Напомнить в Telegram» → бот отвечает «Готово! Напомню о подарке…».
11. **Удаление забронированного:** владелец удаляет подарок из п. 10 → гостю приходит «…удалил(а) «…» из списка…».
12. **Inline:** в любом чате набрать `@my_wish_list1_bot` → список своих вишлистов → выбрать → в чат ушло сообщение с названием, ссылкой и кнопкой «Открыть вишлист».
13. **Canary и напоминания вручную (после «да»):**
```bash
ssh root@200.169.178.231 'bash -s' <<'EOF'
docker exec -w /app wishlist-web-1 node --input-type=module -e '
const { PgBoss } = await import("/app/node_modules/.pnpm/pg-boss@12.31.1/node_modules/pg-boss/dist/index.js");
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, supervise: false, schedule: false, migrate: false });
await boss.start(); await boss.send("canary", {}); await boss.send("reminders", {}); await boss.stop({ graceful: false });' </dev/null
sleep 30
docker logs --since 1m wishlist-worker-1 2>&1 | grep -E "canary finished|reminders processed"
EOF
```
Expected: `canary finished` с `"failures":[]` (алерта администратору нет) и `reminders processed` (сколько гостей — зависит от дат списков).

Логи после сценария:
```bash
ssh root@200.169.178.231 'docker logs --since 30m wishlist-worker-1 2>&1 | grep -E "\"level\":\"(warn|error)\"" | tail -20; docker logs --since 30m wishlist-web-1 2>&1 | grep -iE "error|warn" | grep -v "Server Reference ID" | tail -20'
```
Expected: нет `error`; `warn` разобрать по одному (ожидаемы только `notification rejected by telegram` для гостей, не запускавших бота).

- [ ] **Step 8: Статус плана**

В `00-overview.md` под заголовком добавить (фактическая дата и итоги Step 7):
```
> **Статус: выполнен YYYY-MM-DD.** Прод: бот @my_wish_list1_bot — добавление ссылкой с обновлением карточки, перенос и удаление кнопками, уведомления о бронях (с учётом «Полного сюрприза»), подтверждение и отмена брони гостем, «Напомнить в Telegram» для гостей сайта, inline-режим; canary парсера и проверка сайта шлют алерты администратору. Проверено вручную.
```
Отметить все шаги задач `[x]`.

```bash
git add docs
git commit -m "docs: mark plan 4 done"
git push
```

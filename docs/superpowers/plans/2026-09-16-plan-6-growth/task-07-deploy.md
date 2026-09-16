# Task 7: CI, мерж, деплой и проверка на проде

**Files:**
- Modify: `docs/superpowers/plans/2026-09-16-plan-6-growth/00-overview.md` (статус), `task-*.md` (отметки шагов)

**Interfaces:**
- Consumes: всё из Tasks 1–6; миграции `0003_*`, `0004_*`.
- Produces: выложенный план 6; статус плана.

Каждая команда на сервере — только после явного «да» пользователя.

- [x] **Step 1: Полная проверка ветки**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build && pnpm --filter @wishlist/worker build`
Expected: PASS.

```bash
git push -u origin feat/growth
```
Попросить пользователя дождаться зелёного `ci` на `feat/growth`.

- [x] **Step 2: Мерж и образы (с согласия пользователя)**

```bash
git checkout master && git pull --ff-only && git merge --ff-only feat/growth && git push
```
Дождаться зелёного `images` (web, migrate, worker).

- [x] **Step 3: Деплой (только после «да»)**

Скрипт `$TEMP/deploy-growth.sh`, запуск `ssh root@200.169.178.231 'bash -s' < "$TEMP/deploy-growth.sh"`:
```bash
set -e
cd /opt/wishlist
docker compose --profile tools pull 2>&1 | grep -E "Pulled|error" || true
docker compose run --rm migrate </dev/null 2>&1 | grep -E "migrations applied|ERROR"
docker exec food-tracker-bot-db-1 psql -U wishlist -d wishlist -tA -c "select count(*) from drizzle.__drizzle_migrations" -c "select to_regclass('public.affiliate_clicks'), to_regclass('public.feature_interest')"
docker compose up -d web worker 2>&1 | tail -2
sleep 25
docker compose ps --format "{{.Name}} {{.Status}}"
docker logs --since 1m wishlist-worker-1 2>&1 | grep -E "^\{" | tail -3
curl -fsS https://my-wish-list.online/api/health; echo
curl -s -o /dev/null -w "landing %{http_code}\nprivacy " https://my-wish-list.online/ ; curl -s -o /dev/null -w "%{http_code}\n" https://my-wish-list.online/privacy
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}" | grep wishlist
```
Expected: `migrations applied`; миграций `5`; обе таблицы существуют; `web` healthy, `worker` Up, в логе `worker started` и `bot polling started`; `{"ok":true}`; `landing 200`, `privacy 200`; память в пределах лимитов.

- [x] **Step 4: Проверка вместе с пользователем**

1. **Лендинг:** `https://my-wish-list.online` в окне без входа на телефоне → заголовок, «Собрать в Telegram» открывает бота, «Собрать на сайте» — вход; подвал со ссылкой на политику.
2. **Политика:** `/privacy` — данные оператора верные.
3. **Публичная страница гостем:** «Открыть в магазине ↗» открывает магазин (на телефоне — приложение магазина); внизу «Соберите свой вишлист»; в окне брони строка о согласии.
4. **Клики (после «да»):**
```bash
ssh root@200.169.178.231 'docker exec food-tracker-bot-db-1 psql -U wishlist -d wishlist -c "select store, count(*) from affiliate_clicks group by store"'
```
Expected: переход из п. 3 засчитан один раз, повторный клик в течение суток — не добавился.
5. **Оформление:** на странице своего списка «Хочу другое оформление» → «Спасибо! Учли…».
6. **`/stats`:** пользователь пишет боту `/stats` → отчёт за 7 дней с пользователями, списками, подарками, бронями, переходами и «Хотят оформление: 1». С другого аккаунта Telegram бот на `/stats` не отвечает.

Логи после сценария:
```bash
ssh root@200.169.178.231 'docker logs --since 30m wishlist-web-1 2>&1 | grep -iE "error|warn" | grep -v "Server Reference ID" | tail -10; docker logs --since 30m wishlist-worker-1 2>&1 | grep -E "\"level\":\"(warn|error)\"" | tail -10'
```
Expected: нет `error`.

- [x] **Step 5: Статус плана**

В `00-overview.md` под заголовком добавить строку (фактическая дата и итоги Step 4):
```
> **Статус: выполнен YYYY-MM-DD.** Прод: лендинг, политика конфиденциальности и согласие у брони, переходы в магазин через `/go` со счётчиком, «Соберите свой вишлист» для гостей, «Хочу другое оформление», `/stats` для администратора. Монетизация — в бэклоге, решение по цифрам `/stats`.
```
Отметить все шаги задач `[x]`.

```bash
git add docs
git commit -m "docs: mark plan 6 done"
git push
```

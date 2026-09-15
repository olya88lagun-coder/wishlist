# Task 11: Бакеты, окружение, CI, деплой и проверка на проде

**Files:**
- Modify: `docs/superpowers/plans/2026-09-15-plan-3-parser/00-overview.md` (статус), `task-*.md` (отметки шагов)

**Interfaces:**
- Consumes: всё из Tasks 1–10; сервис `worker` и цель образа `worker` (Task 7); `--maintenance-once` (Task 10); переменные `S3_*` (Tasks 7, 9).
- Produces: работающий прод с воркером; статус плана.

Каждая команда на сервере — только после явного «да» пользователя. Секреты (ключи S3) пользователь вписывает в `.env` сам; в чат и в команды они не попадают.

- [ ] **Step 1: Полная проверка ветки**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build && pnpm --filter @wishlist/worker build`
Expected: PASS.

```bash
git push -u origin feat/parser
```
Попросить пользователя проверить в Actions запуск `ci` на `feat/parser` — зелёный. При красном — получить текст ошибки и исправить.

- [ ] **Step 2: Бакеты и ключи S3 (делает пользователь)**

Инструкция пользователю (панель Timeweb Cloud → Объектное хранилище S3):
1. Создать бакет `wishlist-images`, тип **публичный**, регион Москва (`ru-1`).
2. Создать бакет `wishlist-backups`, тип **приватный**, тот же регион.
3. Скопировать Access Key и Secret Key хранилища (вписывать будет сам в `.env` на шаге 4).

Если имена заняты — выбрать свободные и сообщить их; дальше в командах подставлять фактические имена.

Стоимость и тариф хранилища пользователь видит в панели при создании — решение за ним.

- [ ] **Step 3: Мерж в master и сборка образов (с согласия пользователя)**

```bash
git checkout master && git pull --ff-only && git merge --ff-only feat/parser && git push
```
Попросить пользователя дождаться зелёного `images` — теперь три сборки: `web`, `migrate`, `worker`. При ошибке сборки `worker` (чаще всего — установка `postgresql-client-16` или `sharp`) получить лог шага и исправить в новой ветке.

- [ ] **Step 4: Окружение на сервере (пользователь + «да»)**

Скопировать обновлённый compose (с машины разработчика):
```bash
scp deploy/docker-compose.yml root@200.169.178.231:/opt/wishlist/docker-compose.yml
```

Пользователь сам дописывает в `/opt/wishlist/.env` (`ssh root@200.169.178.231`, затем `nano /opt/wishlist/.env`):
```
S3_ACCESS_KEY_ID=<Access Key>
S3_SECRET_ACCESS_KEY=<Secret Key>
S3_IMAGES_BUCKET=wishlist-images
S3_BACKUPS_BUCKET=wishlist-backups
S3_PUBLIC_BASE_URL=https://s3.twcstorage.ru/wishlist-images
```

Проверка без вывода секретов:
```bash
ssh root@200.169.178.231 'grep -oE "^S3_[A-Z_]+=" /opt/wishlist/.env'
```
Expected: пять имён переменных `S3_...=`.

- [ ] **Step 5: Деплой (только после «да»)**

```bash
ssh root@200.169.178.231 '
set -e
cd /opt/wishlist
docker compose pull
docker compose run --rm migrate
docker compose up -d web worker
sleep 25
docker compose ps
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"
docker logs --since 2m wishlist-worker-1 2>&1 | tail -5
curl -fsS https://my-wish-list.online/api/health'
```
Expected:
- `migrate`: `migrations applied` (применена `0001_*` — таблица `parse_cache`);
- `wishlist-web-1 ... (healthy)`, `wishlist-worker-1 ... Up`;
- память: web < 300 МиБ, worker < 200 МиБ;
- в логе воркера `"message":"worker started"` с `"s3":true`, без `error`;
- `{"ok":true}`.

Если автоматический режим блокирует `ssh` — отдать команду пользователю и прочитать вывод через `read_terminal`.

- [ ] **Step 6: Бэкап и публичный URL фото (только после «да»)**

```bash
ssh root@200.169.178.231 'cd /opt/wishlist && docker compose run --rm worker node apps/worker/dist/main.mjs --maintenance-once'
```
Expected: `parse cache pruned` и `backup stored` с ключом `db/wishlist-....sql.gz` и размером > 0; пользователь видит файл в бакете `wishlist-backups`.

Если `pg_dump: error: server version: 16.x; pg_dump version: ...` — версия клиента в образе не совпала: исправить установку в Dockerfile (Task 10, Step 4) и пересобрать.

- [ ] **Step 7: Проверка на проде вместе с пользователем**

1. Mini App → список «Тест фото» → «Вставьте ссылку на подарок» → ссылка на Wildberries → скелетон «Загружаем данные…» → в течение ~10 с: фото, название, цена, без подсказок.
2. Открыть фото карточки в новой вкладке (долгое нажатие / «Открыть изображение») → адрес `https://s3.twcstorage.ru/wishlist-images/items/...webp`, картинка открывается. Если 403/404 — бакет не публичный или у Timeweb другой формат публичного адреса: проверить в панели ссылку на объект, при формате `https://wishlist-images.s3.twcstorage.ru/...` поменять `S3_PUBLIC_BASE_URL` в `.env` и `docker compose up -d web`.
3. Ссылка на Золотое Яблоко → фото, название, цена.
4. Ссылка на Яндекс Маркет → фото и название, подсказка «Яндекс Маркет не отдал цену — впишите её»; вписать цену через «Изменить» → подсказка исчезла.
5. Ссылка на Ozon → название из адреса и подсказка про цену.
6. Короткая ссылка из приложения Wildberries («Поделиться» → «Скопировать») → раскрылась, данные подтянулись.
7. Публичная ссылка списка на телефоне без входа → фото видны у гостя.
8. Во время проверки: `docker stats --no-stream` — worker < 200 МиБ.

Логи после сценария:
```bash
ssh root@200.169.178.231 'docker logs --since 30m wishlist-worker-1 2>&1 | grep -E "\"level\":\"(warn|error)\"" | tail -20; docker logs --since 30m wishlist-web-1 2>&1 | grep -iE "error|warn" | grep -v "Server Reference ID" | tail -20'
```
Expected: нет `error`; `warn` допустимы только ожидаемые (`image not loaded` для Ozon/Lamoda не бывает — туда не ходим; для прочих — разобрать каждый).

Результаты по магазинам записать в отчёт: какой статус получил каждый, сколько секунд до заполнения.

- [ ] **Step 8: Статус плана**

В `docs/superpowers/plans/2026-09-15-plan-3-parser/00-overview.md` под заголовком добавить строку (фактическая дата и итоги Step 7):
```
> **Статус: выполнен YYYY-MM-DD.** Прод: https://my-wish-list.online — автозаполнение по ссылке (WB, Золотое Яблоко — ok; Маркет, Ozon — partial), фото в S3, ночной бэкап проверены вручную.
```
Отметить все шаги задач `[x]`.

```bash
git add docs
git commit -m "docs: mark plan 3 done"
git push
```

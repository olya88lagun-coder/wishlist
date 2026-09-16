# Деплой на общий VPS

Сервер `root@200.169.178.231` (Timeweb, Москва, 2 ГБ RAM) общий с проектом трекера питания (`/opt/food-tracker-bot`). Трогаем у трекера только две вещи: создаём БД/роль `wishlist` в его Postgres и **дописываем** блок в его `Caddyfile`.

## 1. Swap 2 ГБ

```bash
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q "^/swapfile " /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi
sysctl -w vm.swappiness=10 && echo "vm.swappiness=10" > /etc/sysctl.d/99-wishlist-swap.conf
free -h
```

## 2. База данных

С машины разработчика:
```bash
ssh root@200.169.178.231 'mkdir -p /opt/wishlist && chmod 700 /opt/wishlist'
scp deploy/create-db.sql deploy/docker-compose.yml root@200.169.178.231:/opt/wishlist/
```
На сервере:
```bash
cd /opt/wishlist
[ -f .db_password ] || { openssl rand -hex 24 > .db_password; chmod 600 .db_password; }
docker exec -i food-tracker-bot-db-1 psql -U food_tracker -d postgres -v ON_ERROR_STOP=1 -v pw="$(cat .db_password)" -At < create-db.sql
```
Последняя строка вывода — `wishlist`. Скрипт идемпотентен.

## 3. `.env`

```bash
cd /opt/wishlist
[ -f .env ] || cat > .env <<EOF
APP_URL=https://my-wish-list.online
DATABASE_URL=postgres://wishlist:$(cat .db_password)@db:5432/wishlist
SESSION_SECRET=$(openssl rand -hex 32)
TELEGRAM_BOT_TOKEN=PASTE_TOKEN_HERE
TELEGRAM_BOT_USERNAME=my_wish_list1_bot
VK_CLIENT_ID=54771492
GHCR_OWNER=olya88lagun-coder
EOF
chmod 600 .env
```
Токен бота владелец вписывает сам: `nano /opt/wishlist/.env`.
Доступ к приватным образам: `docker login ghcr.io -u olya88lagun-coder` (пароль — GitHub PAT со scope `read:packages`).

## 4. Миграции и запуск

```bash
cd /opt/wishlist
docker compose --profile tools pull
docker compose run --rm migrate
docker compose up -d web worker
docker compose ps
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"
```

## 5. Caddy

`Caddyfile` смонтирован как отдельный файл: **только дописывать (`>>`)**, не редактировать через `sed -i`/редакторы, которые меняют inode.

```bash
cd /opt/food-tracker-bot
cp Caddyfile Caddyfile.bak-$(date +%Y%m%d%H%M%S)
grep -q "wishlist-web:3000" Caddyfile || printf "\nmy-wish-list.online {\n\tencode gzip\n\treverse_proxy wishlist-web:3000\n}\n" >> Caddyfile
docker exec food-tracker-bot-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
  && docker exec food-tracker-bot-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
curl -fsS https://my-wish-list.online/api/health
curl -fsS -o /dev/null -w "trackermeal %{http_code}\n" https://trackermeal.ru
```
Если `validate` падает — не перезагружать, восстановить `Caddyfile` из `Caddyfile.bak-*`.

**Важно (обнаружено 2026-09-14):** контейнер Caddy трекера может видеть **старую версию** `Caddyfile`, если файл на хосте когда-то заменили новым (git pull, scp, редактор) после старта контейнера — bind-mount одного файла держится за старый inode. Признак: `caddy reload` пишет `config is unchanged`. Проверка: `docker exec food-tracker-bot-caddy-1 cat /etc/caddy/Caddyfile` отличается от файла на хосте.

Применение без перезапуска трекера:
```bash
docker exec -i food-tracker-bot-caddy-1 sh -c "cat > /tmp/Caddyfile" < /opt/food-tracker-bot/Caddyfile
docker exec food-tracker-bot-caddy-1 caddy validate --config /tmp/Caddyfile --adapter caddyfile \
  && docker exec food-tracker-bot-caddy-1 caddy reload --config /tmp/Caddyfile --adapter caddyfile
```
При следующем перезапуске контейнера Caddy перечитает актуальный файл с хоста, где блок уже есть.

## Обновление приложения

После мержа в `master` GitHub Actions публикует новые образы. На сервере:
```bash
cd /opt/wishlist && docker compose --profile tools pull && docker compose run --rm migrate && docker compose up -d web worker
```

## Фото, бэкапы и воркер

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

## Бот

Бот работает внутри контейнера `worker` (long polling). Он использует те же `TELEGRAM_BOT_TOKEN`, `APP_URL` и `SESSION_SECRET`, что и web.

- `ADMIN_TELEGRAM_ID` — кому слать алерты canary парсера (ежедневно 10:00 МСК) и проверки сайта (каждые 5 минут). Узнать id: написать боту `/myid`.
- Inline-режим включается в @BotFather: `/setinline` → выбрать бота → подсказка «название списка».
- Напоминания гостям — ежедневно в 12:00 МСК.
- Одновременно токен может опрашивать только один процесс: не запускать второй воркер с боевым токеном (Telegram ответит 409 Conflict).
- При локальном `APP_URL` (`localhost`) бот не запускается — это признак машины разработчика.

Проверка:
```bash
docker logs --since 10m wishlist-worker-1 2>&1 | grep -E '"(bot polling started|worker started)"'
```

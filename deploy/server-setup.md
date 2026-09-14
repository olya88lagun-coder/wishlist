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
docker compose pull
docker compose run --rm migrate
docker compose up -d web
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

## Обновление приложения

После мержа в `master` GitHub Actions публикует новые образы. На сервере:
```bash
cd /opt/wishlist && docker compose pull && docker compose run --rm migrate && docker compose up -d web
```

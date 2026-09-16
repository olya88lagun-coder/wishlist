# Task 4: CI, мерж, деплой и проверка превью в мессенджерах

**Files:**
- Modify: `docs/superpowers/plans/2026-09-16-plan-5-sharing/00-overview.md` (статус), `task-*.md` (отметки шагов)
- Возможно: `apps/web/src/app/[slug]/share-links.ts` (если адрес MAX не сработает)

**Interfaces:**
- Consumes: всё из Tasks 1–3.
- Produces: превью ссылок на проде; статус плана.

Каждая команда на сервере — только после явного «да» пользователя.

- [ ] **Step 1: Полная проверка ветки**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build && pnpm --filter @wishlist/worker build`
Expected: PASS.

```bash
git push -u origin feat/sharing
```
Попросить пользователя дождаться зелёного `ci` на `feat/sharing`.

- [ ] **Step 2: Мерж и образы (с согласия пользователя)**

```bash
git checkout master && git pull --ff-only && git merge --ff-only feat/sharing && git push
```
Дождаться зелёного `images` (web, migrate, worker).

- [ ] **Step 3: Деплой (только после «да»)**

Новых миграций нет, воркер не менялся — обновляется только `web`:
```bash
ssh root@200.169.178.231 'bash -s' <<'EOF'
set -e
cd /opt/wishlist
docker compose pull web 2>&1 | grep -E "Pulled|error" || true
docker compose up -d web 2>&1 | tail -2
sleep 20
docker compose ps --format "{{.Name}} {{.Status}}"
curl -fsS https://my-wish-list.online/api/health; echo
EOF
```
Expected: `wishlist-web-1 ... (healthy)`, `{"ok":true}`.

- [ ] **Step 4: Превью на проде (только после «да»)**

Взять действующую публичную ссылку списка (у пользователя) и подставить вместо `<slug>`:
```bash
ssh root@200.169.178.231 'S=<slug>; curl -s -o /tmp/og.png -w "og: %{http_code} %{content_type} %{size_download}\n" "https://my-wish-list.online/$S/opengraph-image"; curl -s "https://my-wish-list.online/$S" | grep -oE "<meta property=\"og:[a-z:]+\" content=\"[^\"]{0,90}" | head -6; docker stats --no-stream --format "{{.Name}} {{.MemUsage}}" | grep wishlist-web'
```
Expected: `og: 200 image/png` и 20 000–300 000 байт; в разметке `og:title`, `og:description`, `og:image` с адресом `https://my-wish-list.online/...`, `og:image:width` 1200; память `web` меньше 300 МиБ (рендер превью — самый тяжёлый запрос приложения; если у предела, уменьшить `revalidate` нельзя, а стоит поднять лимит до 400 МБ в `deploy/docker-compose.yml`).

- [ ] **Step 5: Проверка глазами вместе с пользователем**

1. Отправить ссылку списка себе в Telegram (в «Избранное») → под сообщением карточка: название, «список …», число подарков, стикер обратного отсчёта.
2. Открыть публичную страницу на телефоне → блок «Поделиться списком»: «Скопировать ссылку», Telegram, VK, MAX, «Ещё…».
3. Нажать **VK** → открывается окно ВКонтакте с готовым постом и превью.
4. Нажать **MAX** → если открывается MAX с текстом и ссылкой, кнопка остаётся. Если ошибка или пустая страница — убрать MAX из `shareLinks` (и из теста), закоммитить, выложить повторно; на телефоне остаётся «Ещё…» с системным «Поделиться».
5. Отправить ссылку в WhatsApp → превью тоже подтянулось (та же разметка OpenGraph).

Если Telegram показывает старую карточку (кэш превью), проверить в новом чате или дописать `?v=2` к ссылке — кэш у Telegram по адресу.

- [ ] **Step 6: Статус плана**

В `00-overview.md` под заголовком добавить строку (фактическая дата и итоги Step 5):
```
> **Статус: выполнен YYYY-MM-DD.** Прод: превью ссылки списка в стиле «Журнала» (название, чей список, число подарков, обратный отсчёт) в Telegram, VK, WhatsApp; кнопки «Поделиться» — Telegram, VK, MAX, системное «Ещё…».
```
Отметить все шаги задач `[x]`.

```bash
git add docs apps
git commit -m "docs: mark plan 5 done"
git push
```

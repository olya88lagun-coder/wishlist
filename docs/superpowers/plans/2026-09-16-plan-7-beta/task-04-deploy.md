# Task 4: CI, мерж, деплой и проверка отзыва

**Files:**
- Modify: `docs/superpowers/plans/2026-09-16-plan-7-beta/task-0[1-4]-*.md` (отметки шагов)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `/feedback` и новые доли `/stats` на проде.

Каждая команда на сервере — только после явного «да» пользователя. Миграций нет.

- [ ] **Step 1: Ветка**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/web build && pnpm --filter @wishlist/worker build`
Expected: PASS.

```bash
git push -u origin feat/beta
```
Дождаться зелёного `ci` у пользователя.

- [ ] **Step 2: Мерж и образы (с согласия пользователя)**

```bash
git checkout master && git pull --ff-only && git merge --ff-only feat/beta && git push
```
Дождаться зелёного `images`.

- [ ] **Step 3: Деплой (только после «да»)**

```bash
ssh root@200.169.178.231 'bash -s' <<'EOF'
set -e
cd /opt/wishlist
docker compose pull web worker 2>&1 | grep -E "Pulled|error" || true
docker compose up -d web worker 2>&1 | tail -2
sleep 25
docker compose ps --format "{{.Name}} {{.Status}}"
docker logs --since 1m wishlist-worker-1 2>&1 | grep -E "^\{" | tail -2
curl -fsS https://my-wish-list.online/api/health; echo
EOF
```
Expected: оба сервиса Up/healthy, `bot polling started`, `{"ok":true}`.

- [ ] **Step 4: Проверка с пользователем**

1. В боте `/feedback` → вопрос с полем ответа → ответить «тест отзыва» → бот: «Спасибо! Передал…»; администратору пришли строка «📝 Отзыв от …» и пересланное сообщение.
2. Ответ на вопрос со ссылкой на товар не создаёт подарок.
3. На сайте в подвале «Написать отзыв» открывает бота с тем же вопросом.
4. `/stats` показывает строку «Списки: … с 3+ подарками: N (X%), с бронями: M (Y%)».
5. В меню команд бота есть «Написать отзыв».

# План 3 — Автозаполнение по ссылке, фото товаров, S3, бэкапы

> **Статус: выполнен 2026-09-15.** Прод: https://my-wish-list.online — автозаполнение по ссылке: Wildberries (включая короткие ссылки), Золотое Яблоко, Яндекс Маркет (включая `/cc/`) — ok с фото и ценой; Ozon — partial (название из ссылки, без фото: страница товара закрыта антиботом, короткие `/t/` не раскрываются). Фото в S3 (`wishlist-image`), ночной бэкап в `wishlist-backups` проверены вручную.
>
> Находки при выкладке: образ `migrate` в профиле `tools` скачивается только через `docker compose --profile tools pull`; IPv4 сервера Wildberries отвечает 498, поэтому воркер ходит по IPv6 (сеть `egress`); Яндекс Маркет отдаёт капчу на TLS-рукопожатие с ALPN `http/1.1`, поэтому в `safe-fetch` свой коннектор без ALPN.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Владелец вставляет ссылку на товар — карточка сразу появляется скелетоном, через несколько секунд в ней название, фото и цена из магазина; если магазин отдал не всё, интерфейс просит дописать только недостающее. Фото хранятся в нашем S3, база ежесуточно бэкапится в S3.

**Architecture:** Новый пакет `@wishlist/parser` — чистые функции разбора HTML (JSON-LD, OpenGraph, microdata), стратегии магазинов и безопасная загрузка страниц (защита от SSRF, таймауты, лимиты размера, пауза между запросами к одному домену). Новое приложение `apps/worker` (отдельный контейнер, 200 МБ) обрабатывает очередь pg-boss в общем Postgres: парсинг с кэшем 24 ч, фото → WebP через sharp → S3 Timeweb, ночной `pg_dump` → S3. Web только ставит задачу в очередь и раз в 2 с обновляет страницу, пока есть незаполненные карточки. Результат парсинга **заполняет только пустые поля**, поэтому правки владельца во время парсинга не затираются.

**Tech Stack:** как в планах 1–2 (Node 24, pnpm 12, TS 6.0.3, Next 16.3.5, React 19.3, Drizzle 0.45, PGlite 0.5.8, zod 4, Vitest 5) + `pg-boss` 12.31.1, `sharp` 0.35.4, `@aws-sdk/client-s3` 3.1131.0, `undici` 8.10.2, `node-html-parser` 9.0.4, `ipaddr.js` 2.5.0, `esbuild` 0.28.2.

**Spec:** `docs/superpowers/specs/2026-09-13-wishlist-mvp-design.md` (разделы 2 `Item`/`ParseCache`, 3.2, 4.1, 4.4, 4.6, 9)
**Предыдущий план:** `docs/superpowers/plans/2026-09-15-plan-2-lists/` (выполнен)

## Global Constraints

- Значения проекта: `APP_URL` = `https://my-wish-list.online`; сервер `root@200.169.178.231`; каталог деплоя `/opt/wishlist`; ветка разработки `feat/parser`, мерж в `master` только после зелёного CI и согласия пользователя.
- Команды pnpm на машине разработчика: `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"` перед `pnpm ...` (Git Bash).
- **Каждая команда на сервере — только после явного «да» пользователя.** Если автоматический режим Claude Code блокирует `ssh` — дать пользователю команду для запуска в его терминале и прочитать вывод через `read_terminal`.
- Версии зависимостей — ровно указанные выше (pnpm 12 не ставит пакеты моложе суток; не повышать без проверки `npm view <pkg> time`).
- Машина разработчика в Казахстане: Wildberries и другие магазины отвечают ей антиботом. **Настоящие страницы магазинов снимаются только с московского сервера** (Task 1).
- **SSRF:** воркер ходит только на `http/https`, порты 80/443, и только на публичные unicast-адреса (проверка литерального IP в URL и каждого адреса из DNS; повторная проверка на каждом редиректе). Не более 5 редиректов, 15 с на запрос, страница ≤ 4 МБ, картинка ≤ 8 МБ.
- Нагрузка: не более 2 парсингов одновременно; не чаще 1 запроса в 2 с к одному домену; sharp — `concurrency(1)`, без кэша, вход ≤ 40 млн пикселей.
- Фото: WebP, вписать в 800×1000 без увеличения, качество 80; ключ `items/<itemId>/<uuid>.webp`; публичный бакет; `Cache-Control: public, max-age=31536000, immutable`.
- Статус подарка выводится из данных, а не из парсера: `failed` — нет названия, `partial` — нет цены, `ok` — есть название и цена (фото на статус не влияет: вписать его вручную нельзя).
- Результат парсинга пишет только в пустые поля и только если подарок всё ещё `pending`, не удалён и ссылка не менялась.
- Гости не видят карточки `pending` без названия.
- Кэш парсинга `parse_cache`: ключ — нормализованный URL, TTL 24 ч, `failed` не кэшируется, записи старше 7 дней удаляются ночной задачей.
- Бэкап: ежедневно в 03:00 МСК, `pg_dump` клиентом PostgreSQL 16, gzip, приватный бакет, хранить 14 дней; пароль БД не попадает в аргументы процесса и в логи.
- Логи воркера — JSON-строки без персональных данных (ссылки на товары и id — можно; имена, токены, URL с паролем — нельзя).
- S3 Timeweb: endpoint `https://s3.twcstorage.ru`, регион `ru-1`, `forcePathStyle: true`, `requestChecksumCalculation/responseChecksumValidation: "WHEN_REQUIRED"`.
- Лимиты памяти контейнеров: `web` 300 МБ, `worker` 200 МБ (общий сервер 2 ГБ с трекером питания).
- Коммиты — conventional commits, без Co-Authored-By.
- UI — тексты на русском, кнопки начинаются с глагола, стиль «Журнала» из плана 2.

## Отклонения от текста задач (выявлены при выполнении)

- Золотое Яблоко (Task 2): microdata-название берётся только у самого `Product` (внутри есть хлебные крошки со своим `name`), цена — первая положительная (на странице есть `price content="0"`), из заголовка убирается «В наличии: ».
- Яндекс Маркет (Tasks 1, 4): на `TelegramBot` UA с сервера отдаёт капчу — UA заменён на `vkShare; +http://vk.com/dev/Share`. Стратегия `trustPrice: boolean` заменена на `priceFrom: "any" | "jsonld" | "none"`: у Маркета цена берётся только из JSON-LD `Offer` карточки. Редирект на страницу с `captcha` в пути считается неудачной загрузкой.
- Фикстура Маркета снята по ссылке пользователя (каталог рендерится скриптами).
- `packages/db/scripts/dev-db.mjs`: локальная БД не падает, когда клиент обрывает соединение (`ECONNRESET`).

## Задачи

| # | Файл | Что делает |
|---|---|---|
| 1 | `task-01-parser-package-and-fixtures.md` | пакет `@wishlist/parser`, настоящие страницы магазинов с сервера |
| 2 | `task-02-html-extractors.md` | JSON-LD, OpenGraph, microdata, цена, слияние и статус |
| 3 | `task-03-safe-fetch.md` | загрузка без SSRF, лимиты, пауза по доменам |
| 4 | `task-04-parse-pipeline.md` | стратегии магазинов, название из URL, `parseProduct` |
| 5 | `task-05-db-parsing.md` | `parse_cache`, pending-подарки, применение результата, новые поля DTO |
| 6 | `task-06-worker-parse-job.md` | фото → WebP → S3, обработчик задачи парсинга |
| 7 | `task-07-worker-runtime.md` | запуск воркера, pg-boss, сборка, Docker, compose, CI |
| 8 | `task-08-web-enqueue.md` | очередь из web, форма «только ссылка», actions |
| 9 | `task-09-web-photos-ui.md` | фото в карточках, скелетон, опрос, подсказки дозаполнения |
| 10 | `task-10-nightly-backup.md` | ночной `pg_dump` в S3, чистка кэша |
| 11 | `task-11-deploy.md` | бакеты, `.env`, CI, мерж, деплой, проверка на проде |

## Карта новых файлов

```
packages/parser/
  package.json  tsconfig.json  vitest.config.ts
  fixtures/     wildberries.html  goldapple.html  yandex-market.html  SOURCES.md
  src/
    index.ts
    types.ts
    read-fixture.ts       fixtures.test.ts
    html.ts
    price.ts              price.test.ts
    extract/jsonld.ts     extract/opengraph.ts  extract/microdata.ts  extract/extract.test.ts
    merge.ts              merge.test.ts
    real-fixtures.test.ts
    safe-fetch.ts         safe-fetch.test.ts
    throttle.ts           throttle.test.ts
    strategies.ts
    slug-title.ts         slug-title.test.ts
    pipeline.ts           pipeline.test.ts
packages/core/src/queues.ts
packages/db/src/
  schema.ts (parse_cache)  drizzle/0001_*.sql
  parsing.ts               parsing.test.ts
  items.ts / public-view.ts (изменения)  + тесты
apps/worker/
  package.json  tsconfig.json  vitest.config.ts  scripts/build.mjs
  src/
    env.ts          env.test.ts
    log.ts
    images.ts       images.test.ts
    storage.ts
    parse-item.ts   parse-item.test.ts
    backup.ts       backup.test.ts
    maintenance.ts
    main.ts
apps/web/src/
  server/queue.ts  server/forms.ts (изменение)
  components/item-image.ts  item-image.test.ts  item-card-model.ts (изменение)  StoreTile.tsx  ItemCard.tsx
  app/lists/[id]/QuickLinkForm.tsx  PendingRefresher.tsx  parse-hint.ts  parse-hint.test.ts
apps/web/Dockerfile (стадии deps/build/build-worker/worker)
deploy/docker-compose.yml (worker)  deploy/server-setup.md (S3, бэкапы)
.github/workflows/images.yml (worker)
```

## Не входит в план 3

- Бот: добавление пересылкой ссылки, уведомления, напоминания, canary парсера с алертом администратору — план 4.
- OG-картинки списков, кнопки VK/MAX, inline-режим — план 4.
- Партнёрский редирект `/go/:itemId` — план 5.
- Playwright и прокси для Lamoda/Ozon — v2 (в MVP у них название из URL и `partial`).
- Повторное использование одного фото для одинаковых ссылок, удаление фото удалённых подарков из S3.

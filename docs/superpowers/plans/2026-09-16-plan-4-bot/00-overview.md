# План 4 — Telegram-бот: добавление ссылкой, уведомления, напоминания, canary, inline-режим

> **Статус: выполнен 2026-09-16.** Прод: бот @my_wish_list1_bot — `/start`, добавление ссылкой с обновлением карточки (фото, название, цена), кнопки «В список ▾», «Изменить», «Удалить», inline-режим, `/myid`. Очереди и расписания созданы: напоминания 12:00, canary 10:00, проверка сайта каждые 5 минут, бэкап 03:00 (МСК). Проверено вручную: добавление ссылкой, кнопки, inline, прогон canary (`failures: []`) и напоминаний; логи за сутки без ошибок. Уведомления о бронях проверяются владельцем на первой реальной брони — код покрыт тестами.
>
> Находки при выкладке: в сборке одним файлом (esbuild) запрос grammY к Telegram зависал навсегда — grammy вынесен из бандла (`external`), он есть в node_modules образа; с машины разработчика Telegram недоступен, поэтому у обращений к нему таймаут 10 с, а при локальном `APP_URL` бот не запускается; фото в карточке показывается превью ссылки на файл в S3 — на телефоне видно, на десктопном клиенте у пользователя не грузились медиа (проблема клиента, не сервиса).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Пользователь пишет боту ссылку на товар — бот добавляет подарок в его последний список и через несколько секунд показывает карточку с фото и ценой, с кнопками «В список», «Изменить», «Удалить». Владелец узнаёт о бронях (без имени гостя), гость из Telegram получает подтверждение, напоминания за 14, 7 и 2 дня и сообщение, если подарок удалили. Гость с сайта может подключить напоминания в Telegram. Администратор получает алерт, если парсер сломался или сайт не отвечает. В любом чате `@бот` предлагает поделиться своим списком.

**Architecture:** Бот живёт в `apps/worker` (grammY, long polling) рядом с обработчиками pg-boss — отдельного контейнера нет. Web ничего не шлёт в Telegram сам: он ставит задачу `notify` с id подарка, воркер собирает тексты из базы (в очереди нет имён). Каждое уведомление сначала «занимает место» в таблице `notification_log` (не больше 2 сообщений человеку в сутки, одно и то же событие — один раз), потом отправляется. Логика бота — чистые функции и функции над базой, которые тестируются без Telegram; grammY-обработчики только передают им данные. Карточка из бота редактируется после парсинга: в задачу `parse-item` кладётся ссылка на сообщение.

**Tech Stack:** как в плане 3 + `grammy` 1.46.0.

**Spec:** `docs/superpowers/specs/2026-09-13-wishlist-mvp-design.md` (разделы 3.2 «Бот», 3.3 inline-режим, 3.4 отмена через бота и «Напомнить в Telegram», 3.5, 4.6 canary/uptime, 9 «canary»)
**Предыдущий план:** `docs/superpowers/plans/2026-09-15-plan-3-parser/` (выполнен)

## Global Constraints

- Значения проекта: `APP_URL` = `https://my-wish-list.online`; бот `@my_wish_list1_bot`; сервер `root@200.169.178.231`; каталог деплоя `/opt/wishlist`; ветка разработки `feat/bot`, мерж в `master` только после зелёного CI и согласия пользователя.
- Команды pnpm на машине разработчика (Git Bash): `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"` перед `pnpm ...`.
- **Каждая команда на сервере — только после явного «да» пользователя.** Если автоматический режим блокирует `ssh` — дать пользователю команду и прочитать вывод через `read_terminal`. `docker compose run` внутри `ssh ... 'bash -s' < script` съедает stdin — вызывать его с `</dev/null`.
- Токен бота, `SESSION_SECRET` и прочие секреты не попадают в чат, логи и команды; в `.env` на сервере их вписывает пользователь.
- Версии зависимостей — ровно указанные (pnpm 12 не ставит пакеты моложе суток).
- **Приватность (спека 2):** владелец никогда не получает имя гостя или факт, кто дарит; при `surpriseMode` владелец не получает уведомлений о бронях вовсе. В задачах очереди — только id. В логах — только id и технические причины.
- **Анти-спам (спека 3.5):** не более 2 сообщений одному человеку за календарные сутки по Москве (`Europe/Moscow`); напоминания одного дня объединяются в одно сообщение. Сверх лимита сообщение не отправляется (запись в лог `info`).
- Напоминания гостю — за **14, 7 и 2 дня** до `eventDate`, ежедневно в 12:00 МСК, только по активным броням неудалённых подарков.
- Уведомления идут только тем, у кого есть Telegram-identity. Ответ Telegram 403/400 — окончательный отказ (пользователь не запускал бота): без повторов. 429/5xx/сеть — повтор задачи (3 раза через 60 с).
- Бот не принимает больше 5 ссылок из одного сообщения. `callback_data` ≤ 64 байта.
- Внутри Telegram нет цен на темы и ссылок на оплату (спека 4.5) — в этом плане их нет вовсе.
- Если `TELEGRAM_BOT_TOKEN` не задан или Telegram его не принял (локальная разработка с фейковым токеном) — воркер работает без бота и без уведомлений, пишет `warn`.
- Лимиты памяти контейнеров не меняются: `web` 300 МБ, `worker` 200 МБ.
- Логи воркера — JSON-строки (`log.ts`).
- Коммиты — conventional commits, без Co-Authored-By.
- Тексты бота — на русском, коротко, кнопки начинаются с глагола или существительного действия; стиль как в приложении.

## Что уже есть (из планов 1–3)

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `SESSION_SECRET`, `APP_URL` в `.env` сервера (читает web; воркер получает тот же файл через `env_file`).
- Вход в Mini App: `/tg` → `TelegramAutoLogin` → `/api/auth/telegram/miniapp` → `/lists`. Пользователь Telegram = `auth_identities(provider='telegram', provider_user_id=<id>)`; `upsertUserFromIdentity` в `@wishlist/db`.
- Брони: `reservations(item_id, guest_user_id, guest_token, guest_name, cancel_token, status)`; гость из Mini App имеет `guest_user_id`, гость с сайта — только `guest_token`.
- Очередь: pg-boss, web только отправляет (`apps/web/src/server/queue.ts`), воркер создаёт очереди и расписания (`apps/worker/src/main.ts`).

## Задачи

| # | Файл | Что делает |
|---|---|---|
| 1 | `task-01-queues-and-notification-log.md` | типы задач, таблица `notification_log`, запросы уведомлений и напоминаний |
| 2 | `task-02-db-bot-queries.md` | запросы бота: пользователь по Telegram, карточка, перенос, отмена брони, привязка брони; подписанная ссылка напоминаний |
| 3 | `task-03-bot-texts-and-links.md` | тексты сообщений, поиск ссылок в сообщении |
| 4 | `task-04-worker-notify.md` | окружение воркера, отправка в Telegram, задача `notify` |
| 5 | `task-05-web-notices.md` | web ставит `notify`, «Напомнить в Telegram», `/tg?next=` |
| 6 | `task-06-bot-runtime.md` | grammY, `/start`, карточка после парсинга, запуск в воркере |
| 7 | `task-07-bot-add-links.md` | добавление ссылкой, кнопки «В список», «Удалить», «Снять бронь» |
| 8 | `task-08-reminders.md` | ежедневные напоминания 14/7/2 |
| 9 | `task-09-canary-uptime.md` | canary парсера и проверка сайта с алертом администратору |
| 10 | `task-10-inline-mode.md` | inline-режим `@бот` |
| 11 | `task-11-deploy.md` | BotFather, `.env`, CI, мерж, деплой, проверка на проде |

## Карта файлов

```
packages/core/src/queues.ts                    (изменение: notify, reminders, canary, uptime, botMessage)
packages/core/src/auth/reminder-link.ts        reminder-link.test.ts
packages/db/src/
  schema.ts (notification_log)   drizzle/0002_*.sql
  notifications.ts               notifications.test.ts
  bot.ts                         bot.test.ts
  items.ts / public-view.ts (изменения)
apps/worker/src/
  env.ts (изменение)             env.test.ts
  main.ts (изменение)
  jobs.ts                        (регистрация очередей и расписаний)
  telegram/messenger.ts          messenger.test.ts
  notify.ts                      notify.test.ts
  reminders.ts                   reminders.test.ts
  monitoring.ts                  monitoring.test.ts
  bot/texts.ts                   texts.test.ts
  bot/links.ts                   links.test.ts
  bot/keyboards.ts
  bot/card.ts                    card.test.ts
  bot/start.ts                   start.test.ts
  bot/add-links.ts               add-links.test.ts
  bot/callbacks.ts               callbacks.test.ts
  bot/inline.ts                  inline.test.ts
  bot/create-bot.ts
apps/web/src/
  server/queue.ts (enqueueNotify)
  app/[slug]/actions.ts, page.tsx, remind-link.ts  remind-link.test.ts
  app/lists/[id]/actions.ts
  app/tg/next-path.ts            next-path.test.ts   TelegramAutoLogin.tsx
```

## Не входит в план 4

- OG-картинки списков, кнопки VK и MAX на странице списка — план 5.
- Партнёрский редирект `/go/:itemId`, ЮKassa, темы, лендинг — план 6.
- Выбор списка до добавления (бот кладёт в последний созданный список, переносится кнопкой «В список»).
- Уведомление гостя с сайта без привязки Telegram (у него нет канала).
- Webhook-режим бота (long polling достаточно для одного воркера).

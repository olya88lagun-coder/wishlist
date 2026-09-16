# План 5 — Превью списка при отправке ссылки и кнопки «Поделиться»

> **Статус: выполнен 2026-09-16.** Прод: ссылка на список разворачивается в карточку «Журнала» (чей список, название курсивом, число подарков, стикер обратного отсчёта) — проверено в Telegram и VK; кнопки «Поделиться» — Telegram, VK, MAX (адрес `max.ru/:share` работает) и системное «Ещё…». Память web под превью — 85 МиБ из 300.
>
> Отклонения: коллажа из фото подарков нет — фото хранятся в WebP, а `next/og` (satori) понимает только PNG и JPEG; для тестов JSX в `apps/web/vitest.config.ts` включён oxc-трансформ (в tsconfig Next стоит `jsx: "preserve"`); `metadataBase` читает `APP_URL` напрямую из окружения с запасным значением — иначе сборка образа падала на проверке переменных.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Ссылка на список, отправленная в Telegram, VK, MAX или WhatsApp, разворачивается в карточку в стиле «Журнала»: название списка, чьё оно, сколько подарков и сколько дней до праздника. На самой странице списка — кнопки «Скопировать ссылку», Telegram, VK, MAX и системное «Поделиться».

**Architecture:** Картинка превью рисуется маршрутом `opengraph-image` в Next (`next/og`: JSX → PNG 1200×630) по тем же данным, что и публичная страница; шрифты «Журнала» лежат файлами в репозитории. Данные для картинки собирает чистая функция, поэтому тексты и склонения проверяются тестами без рендера. Ссылки кнопок «Поделиться» — тоже чистая функция; кнопка MAX показывается только там, где её адрес работает (проверяется на телефоне в Task 4).

**Tech Stack:** как в планах 1–4 (Node 24, pnpm 12, TS 6.0.3, Next 16.3.5, React 19.3, Drizzle 0.45, zod 4, Vitest 5) + `next/og` (входит в Next).

**Spec:** `docs/superpowers/specs/2026-09-13-wishlist-mvp-design.md` (раздел 3.3 «Шеринг», 5 «Визуальная система»)
**Предыдущий план:** `docs/superpowers/plans/2026-09-16-plan-4-bot/` (выполнен)

## Global Constraints

- Значения проекта: `APP_URL` = `https://my-wish-list.online`; сервер `root@200.169.178.231`; каталог деплоя `/opt/wishlist`; ветка разработки `feat/sharing`, мерж в `master` только после зелёного CI и согласия пользователя.
- Команды pnpm на машине разработчика (Git Bash): `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"` перед `pnpm ...`.
- **Каждая команда на сервере — только после явного «да» пользователя.** `docker compose run` внутри `ssh ... 'bash -s' < script` съедает stdin — вызывать с `</dev/null`.
- Публичная страница остаётся `noindex`: превью для мессенджеров ставится, поисковая выдача не нужна.
- **Приватность:** в превью попадают только название списка, имя владельца (как на странице), число подарков и дней до праздника. Ни имён гостей, ни брони, ни цен.
- Картинка превью — 1200×630 PNG, вес до 300 КБ (иначе Telegram и VK не покажут), рисуется без обращения к S3: фото товаров в WebP, а `next/og` понимает только PNG и JPEG.
- Лимит памяти `web` не меняется — 300 МБ. После выкладки проверить `docker stats` под нагрузкой превью.
- Шрифты — статические `.ttf` с кириллицей в репозитории (`apps/web/assets/fonts`), лицензия OFL; их вес входит в образ.
- Тексты на русском, числительные склоняются (`pluralRu` из `@wishlist/core`).
- Коммиты — conventional commits, без Co-Authored-By.

## Что уже есть (планы 1–4)

- Публичная страница `apps/web/src/app/[slug]/page.tsx` и `getPublicWishlist` (название, имя владельца, дата, подарки).
- `ShareBar` с кнопками «Скопировать ссылку», Telegram и системным «Поделиться».
- Токены «Журнала» в `apps/web/src/app/globals.css`, шрифты Playfair Display и Manrope через `next/font/google`.
- `countdownLabel`, `daysUntil`, `pluralRu`, `EVENT_TIME_ZONE` в `@wishlist/core`.

## Задачи

| # | Файл | Что делает |
|---|---|---|
| 1 | `task-01-og-model.md` | данные для превью: заголовок, подпись, счётчик — чистая функция с тестами |
| 2 | `task-02-og-image.md` | шрифты в репозитории, маршрут `opengraph-image`, мета-теги страницы |
| 3 | `task-03-share-buttons.md` | ссылки шеринга (Telegram, VK, MAX) и обновлённый `ShareBar` |
| 4 | `task-04-deploy.md` | CI, мерж, деплой, проверка превью в мессенджерах и памяти |

## Карта файлов

```
apps/web/assets/fonts/PlayfairDisplay-SemiBoldItalic.ttf   Manrope-SemiBold.ttf
apps/web/src/app/[slug]/
  og-model.ts            og-model.test.ts
  opengraph-image.tsx
  page.tsx               (generateMetadata: openGraph и twitter)
  share-links.ts         share-links.test.ts
apps/web/src/components/ShareBar.tsx   (кнопки VK и MAX)
```

## Не входит в план 5

- Коллаж из фото подарков в превью: фото хранятся в WebP, а рендер превью понимает только PNG и JPEG. Вернуться к этому, когда (и если) воркер начнёт сохранять JPEG-копию для превью.
- Отдельная картинка для каждого подарка.
- Индексация публичных страниц поисковиками (остаётся `noindex`).
- Партнёрский редирект `/go/:itemId`, ЮKassa, темы, лендинг — план 6.

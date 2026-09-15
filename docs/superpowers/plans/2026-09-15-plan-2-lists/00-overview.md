# План 2 — Списки, подарки, бронирование + UI «Журнала»

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Задачи лежат в отдельных файлах `task-NN-*.md` этой папки; выполнять по порядку.

**Goal:** Первая версия продукта, которой можно пользоваться: владелец создаёт несколько списков (повод, дата), вручную добавляет подарки, делится ссылкой; гость без регистрации бронирует и отменяет бронь; владелец видит только «забронировано» (или ничего в режиме «Полный сюрприз»). Пустые профили объединяются при привязке аккаунта.

**Architecture:** Бизнес-правила — чистые функции в `@wishlist/core` (уже есть правила броней из плана 1; добавляются slug, отсчёт дней, деньги, определение магазина). Доступ к данным — репозитории в `@wishlist/db` с тестами на PGlite; **правила приватности применяются в репозитории**, UI получает уже безопасные DTO. Мутации — Server Actions Next.js (встроенная проверка Origin), тонкие обёртки над функциями `apps/web/src/server/*`, которые тестируются без Next. Гость идентифицируется httpOnly-cookie `wl_guest`.

**Tech Stack:** как в плане 1 (Node 24, pnpm 12, TS 6.0.3, Next 16.3.5, React 19.3, Drizzle 0.45, PGlite 0.5.8, zod 4, Vitest 5) + `@electric-sql/pglite-socket` 0.2.11 (локальная БД для `next dev`).

**Spec:** `docs/superpowers/specs/2026-09-13-wishlist-mvp-design.md` (разделы 2, 3.1–3.4, 5, 7)
**Предыдущий план:** `docs/superpowers/plans/2026-09-14-plan-1-foundation.md` (выполнен)

## Global Constraints

- Значения проекта: `APP_URL` = `https://my-wish-list.online`; сервер `root@200.169.178.231`; каталог деплоя `/opt/wishlist`; ветка разработки `feat/lists`, мерж в `master` только после зелёного CI и согласия пользователя.
- Команды pnpm на машине разработчика: `export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"` перед `pnpm ...` (Git Bash).
- **Приватность №1:** ни одна функция, возвращающая данные владельцу, не выбирает из БД `guest_name`, `guest_user_id`, `guest_token`, `cancel_token`. Проверяется тестом, сериализующим результат.
- **Приватность №2:** при `users.surprise_mode = true` владелец не видит даже флаг брони.
- **Гостевые данные:** публичная страница не отдаёт имена других гостей, только статус `free | reserved_by_me | reserved_by_other`.
- Владелец не может бронировать в своём списке (правило `decideReserve`), на публичной странице своего списка кнопок брони нет.
- Slug списка: 10 символов `[0-9A-Za-z]`, криптослучайный; публичный URL `https://my-wish-list.online/<slug>`; страница `noindex`.
- Лимиты от злоупотреблений: `MAX_WISHLISTS_PER_USER = 30`, `MAX_ITEMS_PER_WISHLIST = 150`, длина названия списка ≤ 80, подарка ≤ 200, заметки ≤ 300, URL ≤ 2048, цена 0…10 000 000 ₽.
- Цены храним в копейках (`price_kopecks`), вводим и показываем в рублях.
- Без изображений в этом плане: фото появятся в плане 3 (парсер + S3). Карточка без фото показывает типографскую плашку с названием магазина.
- Rate limit (in-memory, один процесс): бронирование/отмена — 20 в минуту на гостя/IP; создание списков и подарков — 60 в минуту на пользователя.
- Cookie гостя `wl_guest`: httpOnly, Secure, `SameSite=None`, 1 год, значение — 32 байта base64url.
- UI: палитра и шрифты «Журнала» из спеки (крем `#F6F1E7`, графит `#2C2C2A`, розовый `#D4537E`, жёлтый `#FFE66D`; Playfair Display + Manrope); mobile-first; тексты на русском; кнопки — глагол в начале.
- Коммиты — conventional commits, без Co-Authored-By.
- Каждая команда на сервере — только после явного «да» пользователя.
- Схема БД в этом плане **не меняется** (все нужные колонки созданы в плане 1) — новых миграций нет.

## Задачи

| # | Файл | Что делает |
|---|---|---|
| 1 | `task-01-core-helpers.md` | slug, отсчёт дней, деньги, определение магазина |
| 2 | `task-02-wishlists-repo.md` | CRUD списков с лимитами |
| 3 | `task-03-items-repo.md` | CRUD подарков и приватный вид владельца |
| 4 | `task-04-public-and-reservations.md` | публичный вид, бронь и отмена |
| 5 | `task-05-profile-merge-and-settings.md` | объединение пустых профилей, режим сюрприза |
| 6 | `task-06-web-infra.md` | cookie гостя, viewer, rate limit, локальная БД |
| 7 | `task-07-journal-ui-kit.md` | стили и общие компоненты «Журнала» |
| 8 | `task-08-owner-pages.md` | «Мои списки», страница списка, формы подарков |
| 9 | `task-09-public-page.md` | публичная страница, бронирование, «Поделиться» |
| 10 | `task-10-settings-and-deploy.md` | настройки, деплой, ручная проверка |

## Карта новых файлов

```
packages/core/src/
  slug.ts                slug.test.ts
  countdown.ts           countdown.test.ts
  money.ts               money.test.ts
  store.ts               store.test.ts
packages/db/src/
  limits.ts
  wishlists.ts           wishlists.test.ts
  items.ts               items.test.ts
  public-view.ts         public-view.test.ts
  reservations.ts        reservations.test.ts
  users.ts (изменение)   users.test.ts (дополнение)
  test-fixtures.ts       хелперы для тестов (createUser, createList)
apps/web/src/server/
  viewer.ts              guest cookie + текущий пользователь
  rate-limit.ts          rate-limit.test.ts
  forms.ts               forms.test.ts   (zod-схемы форм)
  auth-service.ts (изменение: merge)  auth-service.test.ts (дополнение)
apps/web/src/components/
  CountdownSticker.tsx  ReservedSticker.tsx  ItemCard.tsx  StoreTile.tsx  EmptyState.tsx  SubmitButton.tsx
apps/web/src/app/
  globals.css (замена)
  lists/page.tsx  lists/actions.ts  lists/CreateListForm.tsx
  lists/[id]/page.tsx  lists/[id]/actions.ts  lists/[id]/AddItemForm.tsx  lists/[id]/ItemEditor.tsx
  [slug]/page.tsx  [slug]/actions.ts  [slug]/ReserveSheet.tsx  [slug]/ShareBar.tsx
  me/page.tsx (изменение)  me/actions.ts
  page.tsx (изменение)  tg/TelegramAutoLogin.tsx (изменение)
scripts/dev-db.mjs       локальная PGlite-БД с миграциями
```

## Не входит в план 2

- Фото товаров, автозаполнение по ссылке, S3 — план 3.
- OG-картинки, кнопки VK/MAX, inline-режим и уведомления бота, напоминания 14/7/2 — план 4.
- Темы, ЮKassa, `/go`-редирект, лендинг — план 5.
- E2E на Playwright — план 4 (когда появится полный сценарий шеринга); в плане 2 сценарий покрывается интеграционными тестами репозиториев и серверных функций + ручной проверкой на проде.

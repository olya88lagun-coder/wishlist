# Task 1: Пакет `@wishlist/parser` и настоящие страницы магазинов

**Files:**
- Create: `packages/parser/package.json`, `packages/parser/tsconfig.json`, `packages/parser/vitest.config.ts`, `packages/parser/src/index.ts`, `packages/parser/src/types.ts`
- Create: `packages/parser/fixtures/wildberries.html`, `packages/parser/fixtures/goldapple.html`, `packages/parser/fixtures/yandex-market.html`, `packages/parser/fixtures/SOURCES.md`
- Create: `packages/parser/src/read-fixture.ts` (помощник только для тестов)
- Test: `packages/parser/src/fixtures.test.ts`

**Interfaces:**
- Consumes: `StoreId` из `@wishlist/core` (план 2).
- Produces:
  ```ts
  // types.ts
  type ParseStatus = "ok" | "partial" | "failed";
  type ParsedProduct = { title: string | null; description: string | null; imageUrl: string | null; priceKopecks: number | null; currency: string | null };
  type ParseResult = ParsedProduct & { status: ParseStatus; finalUrl: string; store: StoreId };
  type FetchFailureReason = "blocked" | "timeout" | "http_error" | "too_large" | "network" | "not_html" | "not_image";
  type FetchFailure = { ok: false; reason: FetchFailureReason; status?: number };
  type FetchedPage = { ok: true; url: string; status: number; body: string } | FetchFailure;
  type FetchedImage = { ok: true; bytes: Uint8Array; contentType: string } | FetchFailure;
  type FetchPage = (url: string, options: { userAgent: string }) => Promise<FetchedPage>;
  const EMPTY_PRODUCT: ParsedProduct;
  // read-fixture.ts (не экспортируется из index.ts)
  function readFixture(name: string): string;
  ```
- Фикстуры — сырой HTML, снятый с московского сервера теми же User-Agent, что будет использовать воркер (спайк 2026-09-14, спека 4.4).

- [x] **Step 1: Ветка**

Ветка `feat/parser` создана вместе с этим планом (план закоммичен в неё).
```bash
git checkout feat/parser && git status --short
```
Expected: рабочее дерево чистое.

- [x] **Step 2: Каркас пакета**

`packages/parser/package.json`:
```json
{
  "name": "@wishlist/parser",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc -p tsconfig.json" },
  "dependencies": {
    "@wishlist/core": "workspace:*",
    "ipaddr.js": "2.5.0",
    "node-html-parser": "9.0.4",
    "undici": "8.10.2"
  }
}
```

`packages/parser/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"]
}
```

`packages/parser/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "parser", environment: "node", testTimeout: 20000 },
});
```

`packages/parser/src/types.ts`:
```ts
import type { StoreId } from "@wishlist/core";

export type ParseStatus = "ok" | "partial" | "failed";

export type ParsedProduct = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceKopecks: number | null;
  currency: string | null;
};

export type ParseResult = ParsedProduct & { status: ParseStatus; finalUrl: string; store: StoreId };

export type FetchFailureReason = "blocked" | "timeout" | "http_error" | "too_large" | "network" | "not_html" | "not_image";
export type FetchFailure = { ok: false; reason: FetchFailureReason; status?: number };

export type FetchedPage = { ok: true; url: string; status: number; body: string } | FetchFailure;
export type FetchedImage = { ok: true; bytes: Uint8Array; contentType: string } | FetchFailure;

export type FetchPage = (url: string, options: { userAgent: string }) => Promise<FetchedPage>;

export const EMPTY_PRODUCT: ParsedProduct = { title: null, description: null, imageUrl: null, priceKopecks: null, currency: null };
```

`packages/parser/src/index.ts`:
```ts
export * from "./types";
```

Run: `pnpm install`
Expected: в `pnpm-lock.yaml` появился `packages/parser`; без ошибок `minimumReleaseAge` (версии старше суток).

- [x] **Step 3: Тест на наличие фикстур (падает)**

`packages/parser/src/read-fixture.ts` (отдельный модуль: если импортировать помощник из `*.test.ts`, vitest повторно зарегистрирует тесты того файла):
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function readFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}
```

`packages/parser/src/fixtures.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { readFixture } from "./read-fixture";

describe("store fixtures captured from the Moscow server", () => {
  test("Wildberries page carries a JSON-LD Product", () => {
    const html = readFixture("wildberries.html");
    expect(html).toMatch(/application\/ld\+json/);
    expect(html).toMatch(/"@type"\s*:\s*"Product"/);
  });

  test("Gold Apple page carries OpenGraph and a microdata price", () => {
    const html = readFixture("goldapple.html");
    expect(html).toMatch(/property="og:title"/);
    expect(html).toMatch(/itemprop="price"/);
  });

  test("Yandex Market page carries OpenGraph title and image", () => {
    const html = readFixture("yandex-market.html");
    expect(html).toMatch(/property="og:title"/);
    expect(html).toMatch(/property="og:image"/);
  });
});
```

Run: `pnpm vitest run packages/parser`
Expected: FAIL — `ENOENT: no such file or directory ... fixtures/wildberries.html`.

- [x] **Step 4: Найти живые карточки товаров (сервер, только после «да» пользователя)**

Wildberries: `https://www.wildberries.ru/catalog/173937886/detail.aspx` (товар из проверки плана 2).

Золотое Яблоко и Яндекс Маркет — взять первую ссылку на товар со страницы каталога:
```bash
ssh root@200.169.178.231 '
curl -s -m 20 -A "WhatsApp/2.23.20.0" -H "Accept-Language: ru-RU" -L https://goldapple.ru/parfjumerija | grep -oE "href=\"/[0-9]{8,}-[a-z0-9-]+\"" | head -3
curl -s -m 20 -A "TelegramBot (like TwitterBot)" -H "Accept-Language: ru-RU" -L "https://market.yandex.ru/catalog--naushniki-i-bluetooth-garnitury/18467110" | grep -oE "href=\"/(product--|card/)[^\"?]+" | head -3'
```
Expected: по одному-три пути вида `/19000123456-...` и `/product--.../123456` (или `/card/.../123456`). Полный URL = `https://goldapple.ru` / `https://market.yandex.ru` + путь.

Если grep ничего не нашёл (вёрстка изменилась) — попросить пользователя открыть магазин в браузере и прислать ссылку на любой товар. Ссылки из результатов поиска/рекламы (`/search`, `?clid=`) не подходят.

- [x] **Step 5: Снять страницы (сервер, только после «да» пользователя)**

С машины разработчика, подставив найденные URL в переменные:
```bash
GA_URL="https://goldapple.ru/<путь из шага 4>"
YM_URL="https://market.yandex.ru/<путь из шага 4>"
ssh root@200.169.178.231 'curl -s -m 20 -A "WhatsApp/2.23.20.0" -H "Accept-Language: ru-RU" -L "https://www.wildberries.ru/catalog/173937886/detail.aspx"' > packages/parser/fixtures/wildberries.html
ssh root@200.169.178.231 "curl -s -m 20 -A 'WhatsApp/2.23.20.0' -H 'Accept-Language: ru-RU' -L '$GA_URL'" > packages/parser/fixtures/goldapple.html
ssh root@200.169.178.231 "curl -s -m 20 -A 'TelegramBot (like TwitterBot)' -H 'Accept-Language: ru-RU' -L '$YM_URL'" > packages/parser/fixtures/yandex-market.html
wc -c packages/parser/fixtures/*.html
```
Expected: каждый файл больше 20 КБ. Файл в пару килобайт — антибот или 404: проверить `head -c 500 <файл>`, взять другой товар.

Вырезать из фикстур то, что не нужно тестам и раздувает репозиторий (большие inline-скрипты бандлов), **не нужно** — фикстура должна оставаться сырым ответом магазина, иначе она перестанет ловить изменения вёрстки.

`packages/parser/fixtures/SOURCES.md` (подставить фактические URL и дату):
```markdown
# Фикстуры страниц магазинов

Сняты с сервера Timeweb (Москва) командой `curl -L -A <UA> -H "Accept-Language: ru-RU"`. Используются только в тестах парсера.
Обновлять, когда магазин меняет вёрстку и тесты `real-fixtures.test.ts` перестают отражать реальность.

| Файл | URL | User-Agent | Дата |
|---|---|---|---|
| wildberries.html | https://www.wildberries.ru/catalog/173937886/detail.aspx | WhatsApp/2.23.20.0 | 2026-09-15 |
| goldapple.html | <GA_URL> | WhatsApp/2.23.20.0 | 2026-09-15 |
| yandex-market.html | <YM_URL> | TelegramBot (like TwitterBot) | 2026-09-15 |
```

- [x] **Step 6: Тест проходит**

Run: `pnpm vitest run packages/parser`
Expected: PASS (3 теста). Если падает проверка разметки (например, у Золотого Яблока нет `itemprop="price"`), это находка о смене вёрстки: записать в `SOURCES.md` строку «нет microdata-цены на <дата>», поправить ожидание в тесте на то, что реально есть в HTML (`grep -o 'itemprop="[a-zA-Z]*"' packages/parser/fixtures/goldapple.html | sort | uniq -c`), и учесть в Task 2.

- [x] **Step 7: Проверка и commit**

Run: `pnpm typecheck`
Expected: PASS, в выводе есть `packages/parser typecheck: Done`.

```bash
git add packages/parser pnpm-lock.yaml
git commit -m "feat(parser): package skeleton and store page fixtures"
```
